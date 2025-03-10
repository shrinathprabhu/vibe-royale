const fs = require("fs-extra");
const path = require("path");

async function copyThreeJsFiles() {
  const sourceDir = path.join(__dirname, "node_modules", "three");
  const targetDir = path.join(__dirname, "public", "js", "lib");

  try {
    // Ensure the target directory exists
    await fs.ensureDir(targetDir);

    // Copy the main Three.js file
    await fs.copy(
      path.join(sourceDir, "build", "three.min.js"),
      path.join(targetDir, "three.js")
    );

    // Create a simple PointerLockControls file
    const controlsContent = `
// PointerLockControls.js from Three.js
// Simplified version for our game

THREE.PointerLockControls = function(camera, domElement) {
  this.camera = camera;
  this.domElement = domElement || document.body;
  this.isLocked = false;

  this.minPolarAngle = 0;
  this.maxPolarAngle = Math.PI;

  const scope = this;
  const euler = new THREE.Euler(0, 0, 0, 'YXZ');
  const PI_2 = Math.PI / 2;
  
  function onMouseMove(event) {
    if (scope.isLocked === false) return;

    const movementX = event.movementX || event.mozMovementX || event.webkitMovementX || 0;
    const movementY = event.movementY || event.mozMovementY || event.webkitMovementY || 0;

    euler.setFromQuaternion(camera.quaternion);
    euler.y -= movementX * 0.002;
    euler.x -= movementY * 0.002;
    euler.x = Math.max(-PI_2, Math.min(PI_2, euler.x));
    camera.quaternion.setFromEuler(euler);
  }

  function onPointerlockChange() {
    scope.isLocked = document.pointerLockElement === scope.domElement;
  }

  function onPointerlockError() {
    console.error('THREE.PointerLockControls: Unable to use Pointer Lock API');
  }

  this.connect = function() {
    document.addEventListener('mousemove', onMouseMove, false);
    document.addEventListener('pointerlockchange', onPointerlockChange, false);
    document.addEventListener('pointerlockerror', onPointerlockError, false);
  };

  this.disconnect = function() {
    document.removeEventListener('mousemove', onMouseMove, false);
    document.removeEventListener('pointerlockchange', onPointerlockChange, false);
    document.removeEventListener('pointerlockerror', onPointerlockError, false);
  };

  this.dispose = function() {
    this.disconnect();
  };

  this.getObject = function() {
    return camera;
  };

  this.getDirection = function() {
    const direction = new THREE.Vector3(0, 0, -1);
    const rotation = new THREE.Euler(0, 0, 0, 'YXZ');
    return function(v) {
      rotation.set(euler.x, euler.y, 0);
      v.copy(direction).applyEuler(rotation);
      return v;
    };
  }();

  this.lock = function() {
    this.domElement.requestPointerLock();
  };

  this.unlock = function() {
    document.exitPointerLock();
  };

  this.moveForward = function(distance) {
    const v = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    v.y = 0; // Keep movement horizontal
    v.normalize().multiplyScalar(distance);
    camera.position.add(v);
  };

  this.moveRight = function(distance) {
    const v = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
    v.y = 0; // Keep movement horizontal
    v.normalize().multiplyScalar(distance);
    camera.position.add(v);
  };

  this.connect();
};
`;

    await fs.writeFile(
      path.join(targetDir, "PointerLockControls.js"),
      controlsContent
    );

    console.log("Three.js files copied successfully!");
  } catch (err) {
    console.error("Error copying Three.js files:", err);
    process.exit(1);
  }
}

copyThreeJsFiles();
