import { Hands, HAND_CONNECTIONS } from '@mediapipe/hands';
import { Camera } from '@mediapipe/camera_utils';
import { drawConnectors, drawLandmarks } from '@mediapipe/drawing_utils';

// Performance monitoring
let lastFrameTime = 0;
let frameCount = 0;
const frameWindow = 30;
const framesTimes = new Array(frameWindow).fill(0);
let averageFPS = 60;

// Cached calculation values
const vec3 = { x: 0, y: 0, z: 0 };
function calculateDistance(landmark1, landmark2) {
    vec3.x = landmark1.x - landmark2.x;
    vec3.y = landmark1.y - landmark2.y;
    vec3.z = landmark1.z - landmark2.z;
    return Math.sqrt(vec3.x * vec3.x + vec3.y * vec3.y + vec3.z * vec3.z);
}

// Optimized grab detection with cached values
const fingerTips = [8, 12, 16, 20];
const fingerPips = [6, 10, 14, 18];
const palmBase = 0;
const closedThreshold = 0.06;

function isGrabbing(landmarks) {
    let fingersCurled = 0;
    for (let i = 0; i < fingerTips.length; i++) {
        const tipToPalm = calculateDistance(landmarks[fingerTips[i]], landmarks[palmBase]);
        const pipToPalm = calculateDistance(landmarks[fingerPips[i]], landmarks[palmBase]);
        if (tipToPalm < pipToPalm || tipToPalm < closedThreshold) {
            fingersCurled++;
            if (fingersCurled >= 3) return true; // Early exit
        }
    }
    return false;
}

function getPinchDistance(landmarks) {
    return calculateDistance(landmarks[4], landmarks[8]);
}

export function initHandTracking(onResults) {
    const videoElement = document.getElementById('video-feed');
    const canvasElement = document.getElementById('hand-canvas');
    
    // Set optimal canvas size
    canvasElement.width = 640;
    canvasElement.height = 480;
    
    const canvasCtx = canvasElement.getContext('2d', {
        alpha: false,
        desynchronized: true
    });
    
    let previousPinchDistance = 0;
    let lastGrabState = false;
    const grabHysteresis = 0.2;
    
    // Debounce console logs
    const logPerformance = debounce((fps) => {
        console.log(`Average FPS: ${fps.toFixed(1)}`);
    }, 1000);

    function processResults(results) {
        // Performance monitoring
        const now = performance.now();
        const delta = now - lastFrameTime;
        framesTimes[frameCount % frameWindow] = delta;
        frameCount++;
        
        if (frameCount % frameWindow === 0) {
            averageFPS = 1000 / (framesTimes.reduce((a, b) => a + b) / frameWindow);
            logPerformance(averageFPS);
        }
        lastFrameTime = now;

        // Throttle drawing based on performance
        const shouldDraw = frameCount % (averageFPS < 30 ? 2 : 1) === 0;

        if (shouldDraw) {
            canvasCtx.save();
            canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
            canvasCtx.translate(canvasElement.width, 0);
            canvasCtx.scale(-1, 1);
        }

        if (results.multiHandLandmarks?.[0]) {
            const landmarks = results.multiHandLandmarks[0];
            
            if (shouldDraw) {
                // Optimized drawing
                drawConnectors(canvasCtx, landmarks, HAND_CONNECTIONS, {
                    color: '#00FF00',
                    lineWidth: averageFPS < 30 ? 2 : 3
                });
                
                drawLandmarks(canvasCtx, landmarks, {
                    color: '#FF0000',
                    lineWidth: averageFPS < 30 ? 1 : 2,
                    radius: averageFPS < 30 ? 3 : 4,
                    fillColor: '#FFFFFF'
                });
            }

            // Process hand data with throttling
            if (frameCount % 2 === 0) {
                const currentGrabState = isGrabbing(landmarks);
                const grabState = lastGrabState ? 
                    (currentGrabState || Math.random() > grabHysteresis) : 
                    (currentGrabState && Math.random() < (1 - grabHysteresis));
                
                lastGrabState = grabState;
                
                const handData = {
                    landmarks,
                    isGrabbing: grabState,
                    pinchDistance: getPinchDistance(landmarks),
                    pinchDelta: getPinchDistance(landmarks) - previousPinchDistance,
                    palmPosition: landmarks[0]
                };
                
                previousPinchDistance = handData.pinchDistance;
                onResults(handData);
            }
        }
        
        if (shouldDraw) {
            canvasCtx.restore();
        }
    }

    const hands = new Hands({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
    });

    // Optimized hand tracking settings
    hands.setOptions({
        maxNumHands: 1,
        modelComplexity: 0,  // Use lighter model
        minDetectionConfidence: 0.6,
        minTrackingConfidence: 0.6
    });

    hands.onResults(processResults);

    const camera = new Camera(videoElement, {
        onFrame: async () => {
            await hands.send({image: videoElement});
        },
        width: 640,
        height: 480
    });

    camera.start();
    return hands;
}

// Utility function for debouncing
function debounce(func, wait) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}