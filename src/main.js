import * as THREE from 'three';
import Stats from 'three/examples/jsm/libs/stats.module';
import { initHandTracking } from './scripts/handTracking';

// Performance monitoring
const stats = new Stats();
document.body.appendChild(stats.dom);

// Scene setup with optimized parameters
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);

// Optimized constants
const POSITION_SMOOTHING = 0.15;
const ROTATION_SMOOTHING = 0.08;
const SCALE_SMOOTHING = 0.1;
const MOVEMENT_BOUNDS = 4;
const SCALE_SENSITIVITY = 2.5;
const MIN_FRAME_TIME = 1000 / 60; // Target 60 FPS

// Cached vectors for reuse
const tempVector = new THREE.Vector3();
const movement = new THREE.Vector3();
let lastRenderTime = 0;
let frameCounter = 0;

// State management with optimized initialization
const state = {
    isGrabbed: false,
    lastPosition: new THREE.Vector3(),
    lastScale: new THREE.Vector3(1, 1, 1),
    moveStartPosition: new THREE.Vector3(),
    targetPosition: new THREE.Vector3(),
    targetRotation: new THREE.Euler(),
    targetScale: new THREE.Vector3(1, 1, 1)
};

// Movement constraints
const bounds = {
    position: {
        min: new THREE.Vector3(-MOVEMENT_BOUNDS, -MOVEMENT_BOUNDS, -MOVEMENT_BOUNDS),
        max: new THREE.Vector3(MOVEMENT_BOUNDS, MOVEMENT_BOUNDS, MOVEMENT_BOUNDS)
    },
    scale: {
        min: 0.3,
        max: 2.5
    }
};

// Optimized renderer setup
const renderer = new THREE.WebGLRenderer({ 
    antialias: true,
    powerPreference: "high-performance",
    precision: "mediump"
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Optimized camera setup
const camera = new THREE.PerspectiveCamera(
    75, 
    window.innerWidth / window.innerHeight,
    0.1,
    1000
);
camera.position.z = 5;

// Optimized geometry and material
const geometry = new THREE.BoxGeometry(1, 1, 1);
const material = new THREE.MeshPhongMaterial({ 
    color: 0x00ff00,
    shininess: 80,
    specular: 0x004400,
    flatShading: false
});
const cube = new THREE.Mesh(geometry, material);
scene.add(cube);

// Optimized lighting
const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
const mainLight = new THREE.DirectionalLight(0xffffff, 1);
const fillLight = new THREE.DirectionalLight(0xffffff, 0.3);

mainLight.position.set(5, 5, 5);
fillLight.position.set(-5, -5, -5);

scene.add(ambientLight, mainLight, fillLight);

function constrainPosition(position) {
    tempVector.copy(position).clamp(bounds.position.min, bounds.position.max);
    return tempVector;
}

function updateCubeTransform() {
    cube.position.lerp(state.targetPosition, POSITION_SMOOTHING);
    cube.scale.lerp(state.targetScale, SCALE_SMOOTHING);

    if (state.isGrabbed) {
        movement.subVectors(cube.position, state.lastPosition);
        if (movement.lengthSq() > 0.0001) {
            cube.rotation.x += movement.y * 0.1;
            cube.rotation.y += movement.x * 0.1;
        }
        state.lastPosition.copy(cube.position);
    }
}

function onResults(handData) {
    if (!handData.landmarks) return;

    const palmPosition = handData.palmPosition || handData.landmarks[0];
    
    if (handData.isGrabbing) {
        tempVector.set(
            (palmPosition.x - 0.5) * 8,
            -(palmPosition.y - 0.5) * 6,
            palmPosition.z * 3
        );
        
        state.targetPosition.copy(constrainPosition(tempVector));

        if (!state.isGrabbed) {
            state.moveStartPosition.copy(cube.position);
            cube.material.color.setHex(0xff3333);
        }
        state.isGrabbed = true;
    } else if (state.isGrabbed) {
        cube.material.color.setHex(0x00ff00);
        state.lastPosition.copy(cube.position);
        state.isGrabbed = false;
    }

    if (handData.pinchDelta !== 0) {
        const scaleFactor = 1 + (handData.pinchDelta * SCALE_SENSITIVITY);
        state.targetScale.multiplyScalar(scaleFactor);
        state.targetScale.clampScalar(bounds.scale.min, bounds.scale.max);
    }
}

// Optimized animation loop with frame timing
function animate(currentTime) {
    stats.begin();

    const deltaTime = currentTime - lastRenderTime;
    
    if (deltaTime >= MIN_FRAME_TIME) {
        updateCubeTransform();
        renderer.render(scene, camera);
        lastRenderTime = currentTime;
        
        frameCounter++;
        if (frameCounter % 60 === 0) {
            console.log('Render Info:', renderer.info.render);
            console.log('Memory Info:', renderer.info.memory);
        }
    }

    stats.end();
    requestAnimationFrame(animate);
}

// Optimized resize handler with debouncing
const debouncedResize = debounce(() => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}, 250);

window.addEventListener('resize', debouncedResize, { passive: true });

// Utility function for debouncing
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

// Cleanup function
function cleanup() {
    geometry.dispose();
    material.dispose();
    renderer.dispose();
    window.removeEventListener('resize', debouncedResize);
}

// Initialize and start
initHandTracking(onResults);
animate();

// Export cleanup for potential use
export { cleanup };