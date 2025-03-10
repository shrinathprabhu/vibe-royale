// Game variables
let camera, scene, renderer, controls;
let moveForward = false;
let moveBackward = false;
let moveLeft = false;
let moveRight = false;
let canJump = true;
let isZooming = false;
let zoomLevel = 1;
let velocity = new THREE.Vector3();
let direction = new THREE.Vector3();
let socket;
let rtcManager; // WebRTC connection manager
let pingManager; // Ping manager
let analytics; // Analytics manager
let playerMeshes = {};
let weaponMeshes = [];
let birdMeshes = [];
let chickenMeshes = [];
let wallMeshes = [];
let hurdleMeshes = []; // Array to store hurdle meshes for collision detection
let bloodSplashes = [];
let activeBullets = []; // Array to store active bullets
let wallColliders = []; // Array to store wall colliders
let stats;
let totalPlayersDisplay;
let currentWeaponDisplay;
let gameState;
let playerModel; // For third-person view
let isThirdPerson = false; // Default to first-person view
let showStats = true;
let lastStepTime = 0;
let stepInterval = 300; // ms between footsteps
let volumeLevel = 0.5; // Default volume level
let footstepSound, shootSound, hitSound, deathSound;
let cameraShake = 0; // For movement effect
let currentWeaponType = "pistol"; // Default weapon type
let riverBounds = { x1: -25, x2: 25, z1: -500, z2: 500 }; // River boundaries for 1km map
let lastFrameTime = 0; // For delta time calculation
let botPositions = {}; // Store previous bot positions for interpolation
let lowDetailMode = false; // For performance optimization
let playerNameLabels = {}; // Store player name labels
let weaponLabels = {}; // Store weapon labels
let collectibleLabels = {}; // Store collectible labels
let botLastShootTime = {}; // Track when bots last shot
let playerHelmet = null; // Reference to player's helmet for hiding in FPP
let helmetParts = []; // Store all helmet parts to hide in FPP
let colliders = []; // Store all colliders in the game
let pendingUpdates = {}; // Store pending updates for optimistic UI

const GRAVITY = 9.8;
const JUMP_FORCE = 7; // Increased from 5 to allow jumping on hurdles
const SPRINT_SPEED = 15; // Reduced from 20 for more natural movement
const PLAYER_HEIGHT = 2;
const THIRD_PERSON_DISTANCE = 5;
const COLLISION_RADIUS = 2; // Collision radius for player
const BULLET_SPEED = 50; // Speed of bullets
const BULLET_LIFETIME = 2000; // Bullet lifetime in milliseconds
const MAX_VISIBLE_DISTANCE = 300; // Maximum distance to render objects
const INTERPOLATION_SPEED = 0.1; // Speed of position interpolation for bots
const HURDLE_HEIGHT = 3; // Height of hurdles
const MAP_SIZE = 1000; // 1km x 1km
const BOT_SHOOT_RANGE = 50; // Range at which bots will shoot
const BOT_SHOOT_COOLDOWN = 2000; // Cooldown between bot shots (ms)
const WALL_HEIGHT = 50; // Height of boundary walls
const WALL_THICKNESS = 10; // Thickness of boundary walls
const WALL_BUFFER = 5; // Buffer distance from walls
const BIRD_SIZE = 1.5; // Increased bird size
const BIRD_SPEED_FACTOR = 0.7; // Reduced bird speed (0.7 = 70% of original speed)
const CHICKEN_SIZE = 1.2; // Increased chicken size
const WEAPON_PICKUP_DISTANCE = 5; // Maximum distance to auto-pickup weapons
const WEAPON_PICKUP_INTERVAL = 500; // Check for weapons to pickup every 500ms

// Weapon range configuration
const WEAPON_RANGES = {
  pistol: 100,
  shotgun: 200,
  rifle: 500,
  sniper: 1000,
};

// Weapon damage configuration
const WEAPON_DAMAGE = {
  pistol: 17, // 6 shots to kill (100/17 ≈ 6)
  shotgun: 25, // 4 shots to kill (100/25 = 4)
  rifle: 34, // 3 shots to kill (100/34 ≈ 3)
  sniper: 100, // 1 shot to kill (100/100 = 1)
};

// Helmet protection configuration
const HELMET_PROTECTION = {
  level1: 1, // Blocks 1 bullet
  level2: 2, // Blocks 2 bullets
  level3: 3, // Blocks 3 bullets
};

// Armor protection configuration
const ARMOR_PROTECTION = {
  level1: 1, // Blocks 1 bullet
  level2: 2, // Blocks 2 bullets
  level3: 3, // Blocks 3 bullets
};

// Initialize the game
function init() {
  // Initialize analytics
  analytics = new AnalyticsManager();

  // Scene setup
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87ceeb); // Light blue sky

  // Add fog for performance and aesthetics
  scene.fog = new THREE.Fog(0x87ceeb, 100, MAX_VISIBLE_DISTANCE);

  // Camera setup
  camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    MAX_VISIBLE_DISTANCE
  );
  camera.position.y = PLAYER_HEIGHT;

  // Renderer setup
  renderer = new THREE.WebGLRenderer({ antialias: !lowDetailMode });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = !lowDetailMode;
  if (renderer.shadowMap.enabled) {
    renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Soft shadows
  }
  document.body.appendChild(renderer.domElement);

  // Add performance monitor
  addPerformanceMonitor();

  // Controls setup
  controls = new THREE.PointerLockControls(camera, document.body);

  // Create player model for third-person view
  createPlayerModel();

  // Load sounds
  loadSounds();

  // Event listeners
  document.addEventListener("keydown", onKeyDown);
  document.addEventListener("keyup", onKeyUp);
  document.addEventListener("mousedown", onMouseDown);
  document.addEventListener("mouseup", onMouseUp);
  window.addEventListener("resize", onWindowResize);

  // Create environment
  createEnvironment();

  // Create volume control UI
  createVolumeControl();

  // Add controls info
  addControlsInfo();

  // Create current weapon display
  createCurrentWeaponDisplay();

  // Create total players display
  createTotalPlayersDisplay();

  // Socket.IO setup
  setupSocketIO();

  // Start animation loop
  animate();

  // Start weapon pickup check interval
  setInterval(checkWeaponPickup, WEAPON_PICKUP_INTERVAL);

  // Create a display for WebRTC connection status
  createWebRTCStatusDisplay();
}

// Define the weapon pickup check function
function checkWeaponPickup() {
  if (
    !gameState ||
    !socket ||
    !gameState.players ||
    !gameState.players[socket.id]
  )
    return;

  const player = gameState.players[socket.id];
  if (player.health <= 0) return; // Don't check if player is dead

  const playerPosition = camera.position;

  // Check distance to each weapon
  weaponMeshes.forEach((weaponMesh, index) => {
    if (!weaponMesh.userData || weaponMesh.userData.pickedUp) return;

    const distance = playerPosition.distanceTo(weaponMesh.position);

    // If player is close enough to the weapon
    if (distance < COLLISION_RADIUS) {
      // Apply optimistic UI update
      const weaponId = weaponMesh.userData.weaponId;
      const weaponType = weaponMesh.userData.type;

      // Mark as picked up locally immediately
      weaponMesh.userData.pickedUp = true;

      // Store in pending updates
      pendingUpdates[weaponId] = {
        type: "weaponPickup",
        weaponId: weaponId,
        weaponType: weaponType,
        timestamp: Date.now(),
      };

      // Update UI immediately
      if (currentWeaponDisplay) {
        currentWeaponDisplay.textContent = weaponType.toUpperCase();
      }

      // Emit pickup event to server
      socket.emit("pickupWeapon", {
        weaponId: weaponId,
        type: weaponType,
      });
    }
  });
}

function addPerformanceMonitor() {
  // Add FPS counter
  const fpsCounter = document.createElement("div");
  fpsCounter.id = "fpsCounter";
  fpsCounter.style.position = "fixed";
  fpsCounter.style.top = "10px";
  fpsCounter.style.left = "10px";
  fpsCounter.style.background = "rgba(0, 0, 0, 0.5)";
  fpsCounter.style.color = "white";
  fpsCounter.style.padding = "5px";
  fpsCounter.style.borderRadius = "5px";
  fpsCounter.style.fontSize = "12px";
  document.body.appendChild(fpsCounter);

  // Add performance toggle button
  const perfButton = document.createElement("button");
  perfButton.id = "perfButton";
  perfButton.textContent = "Toggle Performance Mode";
  perfButton.style.position = "fixed";
  perfButton.style.top = "40px";
  perfButton.style.left = "10px";
  perfButton.style.fontSize = "12px";
  perfButton.style.padding = "5px";
  perfButton.style.zIndex = "100";
  perfButton.addEventListener("click", togglePerformanceMode);
  document.body.appendChild(perfButton);
}

function togglePerformanceMode() {
  lowDetailMode = !lowDetailMode;

  // Update renderer settings
  renderer.shadowMap.enabled = !lowDetailMode;

  // Update scene settings
  if (lowDetailMode) {
    scene.fog.near = 50;
    scene.fog.far = 200;
  } else {
    scene.fog.near = 100;
    scene.fog.far = MAX_VISIBLE_DISTANCE;
  }

  // Alert the user
  alert(
    `Performance mode ${
      lowDetailMode ? "enabled" : "disabled"
    }. Refresh for full effect.`
  );
}

function addControlsInfo() {
  const controlsInfo = document.createElement("div");
  controlsInfo.id = "controlsInfo";
  controlsInfo.style.position = "fixed";
  controlsInfo.style.bottom = "10px";
  controlsInfo.style.right = "10px";
  controlsInfo.style.background = "rgba(0, 0, 0, 0.5)";
  controlsInfo.style.color = "white";
  controlsInfo.style.padding = "10px";
  controlsInfo.style.borderRadius = "5px";
  controlsInfo.style.fontSize = "12px";
  controlsInfo.style.zIndex = "100";
  controlsInfo.innerHTML = `
    <div style="font-weight: bold; margin-bottom: 5px;">Controls:</div>
    <div>WASD / Arrows: Move</div>
    <div>Left Shift: Jump</div>
    <div>Space: Shoot</div>
    <div>P: Pickup Weapon</div>
    <div>B: Toggle Stats</div>
    <div>M: Volume Control</div>
  `;
  document.body.appendChild(controlsInfo);
}

function createCurrentWeaponDisplay() {
  // Create a div to display current weapon
  currentWeaponDisplay = document.createElement("div");
  currentWeaponDisplay.id = "currentWeapon";
  currentWeaponDisplay.style.position = "fixed";
  currentWeaponDisplay.style.bottom = "10px";
  currentWeaponDisplay.style.left = "10px";
  currentWeaponDisplay.style.background = "rgba(0, 0, 0, 0.5)";
  currentWeaponDisplay.style.color = "white";
  currentWeaponDisplay.style.padding = "10px";
  currentWeaponDisplay.style.borderRadius = "5px";
  currentWeaponDisplay.style.fontSize = "16px";
  currentWeaponDisplay.style.fontWeight = "bold";
  currentWeaponDisplay.style.zIndex = "100";
  currentWeaponDisplay.textContent = "PISTOL";
  currentWeaponDisplay.style.display = "none"; // Hide the weapon display
  document.body.appendChild(currentWeaponDisplay);
}

function createTotalPlayersDisplay() {
  // The player count is now shown in the stats display, so this function is empty
  // We keep the function to avoid changing other code that might call it
  return;
}

function createPlayerModel() {
  // Create a more detailed player model for third-person view
  playerModel = new THREE.Group();
  helmetParts = []; // Clear helmet parts array

  // Head (spherical)
  const headGeometry = new THREE.SphereGeometry(0.4, 16, 16);
  const headMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff });
  const head = new THREE.Mesh(headGeometry, headMaterial);
  head.position.y = 1.8;
  head.castShadow = true;
  playerModel.add(head);

  // Create a separate helmet group
  const helmetGroup = new THREE.Group();

  // Helmet (rounded at top, flat at bottom)
  const helmetGeometry = new THREE.SphereGeometry(
    0.45,
    16,
    16,
    0,
    Math.PI * 2,
    0,
    Math.PI / 2
  );
  const helmetMaterial = new THREE.MeshStandardMaterial({
    color: 0x444444,
    transparent: true,
    opacity: 0.0, // Start completely transparent
  });
  const helmet = new THREE.Mesh(helmetGeometry, helmetMaterial);
  helmet.position.y = 1.9;
  helmet.castShadow = true;
  helmet.userData.isHelmet = true; // Mark as helmet for hiding in FPP
  helmetGroup.add(helmet);
  playerHelmet = helmet; // Store reference to helmet
  helmetParts.push(helmet); // Add to helmet parts array

  // Add helmet to player model
  playerModel.add(helmetGroup);

  // Torso (cylindrical)
  const torsoGeometry = new THREE.CylinderGeometry(0.4, 0.4, 1, 16);
  const torsoMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff });
  const torso = new THREE.Mesh(torsoGeometry, torsoMaterial);
  torso.position.y = 1.1;
  torso.castShadow = true;
  playerModel.add(torso);

  // Armor (rounded on sides, flat top/bottom)
  const armorGeometry = new THREE.CylinderGeometry(0.45, 0.45, 1.1, 16);
  const armorMaterial = new THREE.MeshStandardMaterial({ color: 0x444444 });
  const armor = new THREE.Mesh(armorGeometry, armorMaterial);
  armor.position.y = 1.1;
  armor.castShadow = true;
  playerModel.add(armor);

  // Arms (cylindrical)
  const armGeometry = new THREE.CylinderGeometry(0.15, 0.15, 0.8, 16);
  const armMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff });

  const leftArm = new THREE.Mesh(armGeometry, armMaterial);
  leftArm.position.set(-0.6, 1.1, 0);
  leftArm.rotation.z = Math.PI / 6;
  leftArm.castShadow = true;
  playerModel.add(leftArm);

  const rightArm = new THREE.Mesh(armGeometry, armMaterial);
  rightArm.position.set(0.6, 1.1, 0);
  rightArm.rotation.z = -Math.PI / 6;
  rightArm.castShadow = true;
  playerModel.add(rightArm);

  // Legs (cylindrical)
  const legGeometry = new THREE.CylinderGeometry(0.2, 0.2, 0.9, 16);
  const legMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff });

  const leftLeg = new THREE.Mesh(legGeometry, legMaterial);
  leftLeg.position.set(-0.25, 0.45, 0);
  leftLeg.castShadow = true;
  leftLeg.userData.isLeg = true; // Mark as leg for animation
  playerModel.add(leftLeg);

  const rightLeg = new THREE.Mesh(legGeometry, legMaterial);
  rightLeg.position.set(0.25, 0.45, 0);
  rightLeg.castShadow = true;
  rightLeg.userData.isLeg = true; // Mark as leg for animation
  playerModel.add(rightLeg);

  // Shield (flat rectangular)
  const shieldGeometry = new THREE.BoxGeometry(0.5, 0.8, 0.1);
  const shieldMaterial = new THREE.MeshStandardMaterial({ color: 0x444444 });
  const shield = new THREE.Mesh(shieldGeometry, shieldMaterial);
  shield.position.set(-0.6, 1.1, 0.3);
  shield.castShadow = true;
  playerModel.add(shield);

  // Gun (simple box)
  const gunGeometry = new THREE.BoxGeometry(0.1, 0.2, 0.6);
  const gunMaterial = new THREE.MeshStandardMaterial({ color: 0x000000 });
  const gun = new THREE.Mesh(gunGeometry, gunMaterial);
  gun.position.set(0.6, 1.1, 0.4);
  gun.castShadow = true;
  playerModel.add(gun);

  playerModel.visible = false; // Initially hidden (first-person view)
  scene.add(playerModel);

  // Create first-person gun model
  createFirstPersonGun();
}

function createFirstPersonGun() {
  // Create a gun model for first-person view
  const gunGroup = new THREE.Group();

  // Gun body
  const gunBodyGeometry = new THREE.BoxGeometry(0.1, 0.2, 0.6);
  const gunBodyMaterial = new THREE.MeshStandardMaterial({ color: 0x000000 });
  const gunBody = new THREE.Mesh(gunBodyGeometry, gunBodyMaterial);
  gunBody.castShadow = true;
  gunGroup.add(gunBody);

  // Gun barrel
  const gunBarrelGeometry = new THREE.CylinderGeometry(0.05, 0.05, 0.4, 16);
  const gunBarrelMaterial = new THREE.MeshStandardMaterial({ color: 0x222222 });
  const gunBarrel = new THREE.Mesh(gunBarrelGeometry, gunBarrelMaterial);
  gunBarrel.rotation.x = Math.PI / 2;
  gunBarrel.position.z = 0.5;
  gunBarrel.castShadow = true;
  gunGroup.add(gunBarrel);

  // Position the gun in the bottom right corner of the view
  gunGroup.position.set(0.3, -0.3, -0.5);

  // Add to camera so it moves with the player view
  camera.add(gunGroup);
}

function loadSounds() {
  // Create audio elements
  footstepSound = new Audio("/sounds/footstep.mp3");
  shootSound = new Audio("/sounds/shoot.mp3");
  hitSound = new Audio("/sounds/hit.mp3");
  deathSound = new Audio("/sounds/death.mp3");

  // Set volume
  footstepSound.volume = volumeLevel;
  shootSound.volume = volumeLevel;
  hitSound.volume = volumeLevel;
  deathSound.volume = volumeLevel;

  // Comment out actual sound loading for now as requested
  // footstepSound.src = '/sounds/footstep.mp3';
  // shootSound.src = '/sounds/shoot.mp3';
  // hitSound.src = '/sounds/hit.mp3';
  // deathSound.src = '/sounds/death.mp3';
}

function createVolumeControl() {
  const volumeControl = document.createElement("div");
  volumeControl.id = "volumeControl";
  volumeControl.style.position = "fixed";
  volumeControl.style.bottom = "20px";
  volumeControl.style.right = "20px";
  volumeControl.style.background = "rgba(0, 0, 0, 0.5)";
  volumeControl.style.padding = "10px";
  volumeControl.style.borderRadius = "5px";
  volumeControl.style.color = "white";
  volumeControl.style.display = "none";
  volumeControl.style.pointerEvents = "auto";

  volumeControl.innerHTML = `
    <div>Volume Control</div>
    <input type="range" id="volumeSlider" min="0" max="1" step="0.1" value="${volumeLevel}">
  `;

  document.getElementById("ui").appendChild(volumeControl);

  document
    .getElementById("volumeSlider")
    .addEventListener("input", function (e) {
      volumeLevel = parseFloat(e.target.value);
      updateSoundVolumes();
    });
}

function updateSoundVolumes() {
  footstepSound.volume = volumeLevel;
  shootSound.volume = volumeLevel;
  hitSound.volume = volumeLevel;
  deathSound.volume = volumeLevel;
}

function createEnvironment() {
  // Ground
  const groundGeometry = new THREE.PlaneGeometry(MAP_SIZE, MAP_SIZE);
  const groundMaterial = new THREE.MeshStandardMaterial({ color: 0x3a9d23 }); // Green color
  const ground = new THREE.Mesh(groundGeometry, groundMaterial);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // Create Y-shaped river
  createYShapedRiver();

  // Create boundary walls with brick texture
  createBoundaryWalls();

  // Add rocks (hurdles)
  hurdleMeshes = []; // Clear existing hurdles
  for (let i = 0; i < 50; i++) {
    const rockGeometry = new THREE.BoxGeometry(5, HURDLE_HEIGHT, 5);
    const rockMaterial = new THREE.MeshStandardMaterial({ color: 0x8b4513 }); // Brown color
    const rock = new THREE.Mesh(rockGeometry, rockMaterial);

    // Ensure hurdles don't spawn in the river
    let validPosition = false;
    let x, z;

    while (!validPosition) {
      x = (Math.random() - 0.5) * (MAP_SIZE - 50); // Keep away from walls
      z = (Math.random() - 0.5) * (MAP_SIZE - 50); // Keep away from walls

      // Check if position is not in the river
      if (!isInRiver(x, z)) {
        validPosition = true;
      }
    }

    rock.position.x = x;
    rock.position.z = z;
    rock.position.y = HURDLE_HEIGHT / 2;
    rock.castShadow = true;
    rock.receiveShadow = true;
    rock.userData.isHurdle = true;
    scene.add(rock);
    hurdleMeshes.push(rock); // Add to hurdles array for collision detection

    // Add to colliders
    colliders.push({
      type: "hurdle",
      mesh: rock,
      bounds: {
        minX: x - 2.5,
        maxX: x + 2.5,
        minY: 0,
        maxY: HURDLE_HEIGHT,
        minZ: z - 2.5,
        maxZ: z + 2.5,
      },
    });
  }

  // Lighting
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
  directionalLight.position.set(0, 100, 0);
  directionalLight.castShadow = true;

  // Improve shadow quality
  directionalLight.shadow.mapSize.width = lowDetailMode ? 1024 : 2048;
  directionalLight.shadow.mapSize.height = lowDetailMode ? 1024 : 2048;
  directionalLight.shadow.camera.near = 0.5;
  directionalLight.shadow.camera.far = 500;
  directionalLight.shadow.camera.left = -100;
  directionalLight.shadow.camera.right = 100;
  directionalLight.shadow.camera.top = 100;
  directionalLight.shadow.camera.bottom = -100;

  scene.add(directionalLight);
}

function createYShapedRiver() {
  // Main river (vertical part)
  const mainRiverWidth = 50;
  const mainRiverLength = MAP_SIZE;
  const mainRiverGeometry = new THREE.PlaneGeometry(
    mainRiverWidth,
    mainRiverLength
  );
  const riverMaterial = new THREE.MeshStandardMaterial({ color: 0x0000ff }); // Blue color
  const mainRiver = new THREE.Mesh(mainRiverGeometry, riverMaterial);
  mainRiver.rotation.x = -Math.PI / 2;
  mainRiver.position.y = 0.1;
  mainRiver.receiveShadow = true;
  scene.add(mainRiver);

  // Left branch (diagonal)
  const branchRiverWidth = 40;
  const branchRiverLength = MAP_SIZE / 2;
  const leftBranchGeometry = new THREE.PlaneGeometry(
    branchRiverWidth,
    branchRiverLength
  );
  const leftBranch = new THREE.Mesh(leftBranchGeometry, riverMaterial);
  leftBranch.rotation.x = -Math.PI / 2;
  leftBranch.rotation.z = Math.PI / 4; // 45 degrees
  leftBranch.position.set(-MAP_SIZE / 4, 0.1, -MAP_SIZE / 4);
  leftBranch.receiveShadow = true;
  scene.add(leftBranch);

  // Right branch (diagonal)
  const rightBranchGeometry = new THREE.PlaneGeometry(
    branchRiverWidth,
    branchRiverLength
  );
  const rightBranch = new THREE.Mesh(rightBranchGeometry, riverMaterial);
  rightBranch.rotation.x = -Math.PI / 2;
  rightBranch.rotation.z = -Math.PI / 4; // -45 degrees
  rightBranch.position.set(MAP_SIZE / 4, 0.1, -MAP_SIZE / 4);
  rightBranch.receiveShadow = true;
  scene.add(rightBranch);

  // Update river bounds for spawn logic
  riverBounds = {
    mainVertical: {
      x1: -mainRiverWidth / 2,
      x2: mainRiverWidth / 2,
      z1: -MAP_SIZE / 2,
      z2: MAP_SIZE / 2,
    },
    leftBranch: {
      angle: Math.PI / 4,
      width: branchRiverWidth,
      x: -MAP_SIZE / 4,
      z: -MAP_SIZE / 4,
      length: branchRiverLength,
    },
    rightBranch: {
      angle: -Math.PI / 4,
      width: branchRiverWidth,
      x: MAP_SIZE / 4,
      z: -MAP_SIZE / 4,
      length: branchRiverLength,
    },
  };
}

function isInRiver(x, z) {
  // Check main vertical river
  if (
    x >= riverBounds.mainVertical.x1 &&
    x <= riverBounds.mainVertical.x2 &&
    z >= riverBounds.mainVertical.z1 &&
    z <= riverBounds.mainVertical.z2
  ) {
    return true;
  }

  // Check left branch (diagonal)
  const leftBranch = riverBounds.leftBranch;
  const leftDx = x - leftBranch.x;
  const leftDz = z - leftBranch.z;
  const leftRotatedX =
    leftDx * Math.cos(-leftBranch.angle) - leftDz * Math.sin(-leftBranch.angle);
  const leftRotatedZ =
    leftDx * Math.sin(-leftBranch.angle) + leftDz * Math.cos(-leftBranch.angle);

  if (
    Math.abs(leftRotatedX) <= leftBranch.width / 2 &&
    leftRotatedZ >= 0 &&
    leftRotatedZ <= leftBranch.length
  ) {
    return true;
  }

  // Check right branch (diagonal)
  const rightBranch = riverBounds.rightBranch;
  const rightDx = x - rightBranch.x;
  const rightDz = z - rightBranch.z;
  const rightRotatedX =
    rightDx * Math.cos(-rightBranch.angle) -
    rightDz * Math.sin(-rightBranch.angle);
  const rightRotatedZ =
    rightDx * Math.sin(-rightBranch.angle) +
    rightDz * Math.cos(-rightBranch.angle);

  if (
    Math.abs(rightRotatedX) <= rightBranch.width / 2 &&
    rightRotatedZ >= 0 &&
    rightRotatedZ <= rightBranch.length
  ) {
    return true;
  }

  return false; // No collision
}

function createBoundaryWalls() {
  // Create brick texture
  const brickTexture = createBrickTexture();
  wallMeshes = []; // Clear existing walls
  colliders = colliders.filter((c) => c.type !== "wall"); // Remove existing wall colliders

  const halfSize = MAP_SIZE / 2;

  // North wall
  const northWall = createWall(
    MAP_SIZE,
    WALL_HEIGHT,
    WALL_THICKNESS,
    brickTexture
  );
  northWall.position.set(0, WALL_HEIGHT / 2, -halfSize);
  northWall.userData.isWall = true;
  northWall.userData.wallType = "north";
  scene.add(northWall);
  wallMeshes.push(northWall);
  colliders.push({
    type: "wall",
    mesh: northWall,
    bounds: {
      minX: -MAP_SIZE / 2,
      maxX: MAP_SIZE / 2,
      minY: 0,
      maxY: WALL_HEIGHT,
      minZ: -halfSize - WALL_THICKNESS / 2,
      maxZ: -halfSize + WALL_THICKNESS / 2,
    },
  });

  // South wall
  const southWall = createWall(
    MAP_SIZE,
    WALL_HEIGHT,
    WALL_THICKNESS,
    brickTexture
  );
  southWall.position.set(0, WALL_HEIGHT / 2, halfSize);
  southWall.userData.isWall = true;
  southWall.userData.wallType = "south";
  scene.add(southWall);
  wallMeshes.push(southWall);
  colliders.push({
    type: "wall",
    mesh: southWall,
    bounds: {
      minX: -MAP_SIZE / 2,
      maxX: MAP_SIZE / 2,
      minY: 0,
      maxY: WALL_HEIGHT,
      minZ: halfSize - WALL_THICKNESS / 2,
      maxZ: halfSize + WALL_THICKNESS / 2,
    },
  });

  // East wall
  const eastWall = createWall(
    WALL_THICKNESS,
    WALL_HEIGHT,
    MAP_SIZE,
    brickTexture
  );
  eastWall.position.set(halfSize, WALL_HEIGHT / 2, 0);
  eastWall.userData.isWall = true;
  eastWall.userData.wallType = "east";
  scene.add(eastWall);
  wallMeshes.push(eastWall);
  colliders.push({
    type: "wall",
    mesh: eastWall,
    bounds: {
      minX: halfSize - WALL_THICKNESS / 2,
      maxX: halfSize + WALL_THICKNESS / 2,
      minY: 0,
      maxY: WALL_HEIGHT,
      minZ: -MAP_SIZE / 2,
      maxZ: MAP_SIZE / 2,
    },
  });

  // West wall
  const westWall = createWall(
    WALL_THICKNESS,
    WALL_HEIGHT,
    MAP_SIZE,
    brickTexture
  );
  westWall.position.set(-halfSize, WALL_HEIGHT / 2, 0);
  westWall.userData.isWall = true;
  westWall.userData.wallType = "west";
  scene.add(westWall);
  wallMeshes.push(westWall);
  colliders.push({
    type: "wall",
    mesh: westWall,
    bounds: {
      minX: -halfSize - WALL_THICKNESS / 2,
      maxX: -halfSize + WALL_THICKNESS / 2,
      minY: 0,
      maxY: WALL_HEIGHT,
      minZ: -MAP_SIZE / 2,
      maxZ: MAP_SIZE / 2,
    },
  });
}

function createWall(width, height, depth, texture) {
  const geometry = new THREE.BoxGeometry(width, height, depth);
  const material = new THREE.MeshStandardMaterial({
    color: 0xcccccc, // Light gray
    map: texture,
    roughness: 0.7,
    metalness: 0.1,
  });
  const wall = new THREE.Mesh(geometry, material);
  wall.castShadow = true;
  wall.receiveShadow = true;
  return wall;
}

function createBrickTexture() {
  // Create a canvas for the brick texture
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");

  // Fill background
  ctx.fillStyle = "#CCCCCC";
  ctx.fillRect(0, 0, 256, 256);

  // Draw bricks
  ctx.fillStyle = "#AAAAAA";

  // First row
  for (let i = 0; i < 8; i++) {
    ctx.fillRect(i * 32, 0, 30, 30);
    ctx.fillRect(i * 32, 64, 30, 30);
    ctx.fillRect(i * 32, 128, 30, 30);
    ctx.fillRect(i * 32, 192, 30, 30);
  }

  // Second row (offset)
  for (let i = 0; i < 8; i++) {
    ctx.fillRect(i * 32 + 16, 32, 30, 30);
    ctx.fillRect(i * 32 + 16, 96, 30, 30);
    ctx.fillRect(i * 32 + 16, 160, 30, 30);
    ctx.fillRect(i * 32 + 16, 224, 30, 30);
  }

  // Create texture from canvas
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(4, 4);

  return texture;
}

function setupSocketIO() {
  socket = io();

  socket.on("connect_error", (error) => {
    console.error("Socket connection error:", error);
    document.getElementById("loading").style.display = "none";
    document.getElementById("login").style.display = "block";
    alert("Failed to connect to game server. Please try again.");
  });

  socket.on("gameState", (state) => {
    gameState = state;
    updateGameState(state);
  });

  socket.on("shotFeedback", (data) => {
    if (data.hit) {
      // Play hit sound
      if (hitSound) {
        hitSound.currentTime = 0;
        hitSound
          .play()
          .catch((e) => console.error("Error playing hit sound:", e));
      }
    }
  });

  // Initialize WebRTC Manager once socket connection is established
  socket.on("connect", () => {
    console.log("Socket connected, initializing WebRTC");
    // Initialize WebRTC with callback for handling peer messages
    rtcManager = new WebRTCManager(socket, handlePeerMessage);

    // Initialize Ping Manager
    pingManager = new PingManager(socket);
  });

  // Handle player updates from server that still come through Socket.IO
  socket.on("playerUpdate", (data) => {
    const { id, updates } = data;
    // Only process updates for other players that aren't via WebRTC
    if (id !== socket.id && !playerUpdatesViaWebRTC.has(id)) {
      updatePlayer(id, updates);
    }
  });
}

// Handle messages received through WebRTC
function handlePeerMessage(peerId, message) {
  // Skip processing if in low performance mode and not critical
  if (isLowPerformanceMode && message.type === "playerPosition") {
    // Process only every other position update in low performance mode
    if (frameCounter % 2 !== 0) return;
  }

  switch (message.type) {
    case "playerPosition":
      // Update player position from peer
      if (gameState && gameState.players && gameState.players[peerId]) {
        const updates = {
          position: message.position,
          rotation: message.rotation,
        };
        updatePlayer(peerId, updates);
      }
      break;

    case "playerShoot":
      // Handle other player shooting
      if (gameState && gameState.players && gameState.players[peerId]) {
        handlePeerShot(peerId, message.direction);
      }
      break;

    case "peerPing":
      // Send immediate pong response for latency measurement
      rtcManager.sendToPeer(peerId, {
        type: "peerPong",
        timestamp: message.timestamp,
      });
      break;

    case "peerPong":
      // Calculate and display RTT (Round Trip Time)
      const rtt = Date.now() - message.timestamp;
      // Store RTT for display
      peerLatency[peerId] = rtt;
      break;
  }
}

// Set to track which player updates are coming via WebRTC
const playerUpdatesViaWebRTC = new Set();
// Map to store peer latency measurements
const peerLatency = {};

// Add a rate limiter for WebRTC broadcasts
let lastWebRTCBroadcast = 0;
const WEBRTC_BROADCAST_INTERVAL = 50; // ms between broadcasts (20 updates per second)

// Send player position via WebRTC to all peers with rate limiting
function broadcastPositionViaPeers() {
  if (!rtcManager || !gameState || !gameState.players || !socket) return;

  const player = gameState.players[socket.id];
  if (!player) return;

  const currentTime = performance.now();

  // Rate limit updates based on performance
  let updateInterval = WEBRTC_BROADCAST_INTERVAL;
  if (isLowPerformanceMode) {
    updateInterval = WEBRTC_BROADCAST_INTERVAL * 2; // Half the update rate in low performance mode
  }

  // Skip if too soon after last broadcast
  if (currentTime - lastWebRTCBroadcast < updateInterval) return;

  lastWebRTCBroadcast = currentTime;

  // Only broadcast if we have peers
  if (rtcManager.getConnectedPeerCount() > 0) {
    rtcManager.broadcast({
      type: "playerPosition",
      position: player.position,
      rotation: player.rotation,
    });
  }
}

// Handle shooting via WebRTC
function shootViaPeers(direction) {
  if (!rtcManager) return false;

  // Broadcast shooting to all peers
  const success = rtcManager.broadcast({
    type: "playerShoot",
    direction: direction,
  });

  return success > 0;
}

// Measure latency to peers periodically
function measurePeerLatency() {
  if (!rtcManager) return;

  rtcManager.peers.forEach((peer, peerId) => {
    if (peer.connected) {
      rtcManager.sendToPeer(peerId, {
        type: "peerPing",
        timestamp: Date.now(),
      });
    }
  });
}

// Start measuring peer latency at regular intervals
setInterval(measurePeerLatency, 2000);

// Add a variable to track if player is dead
let playerIsDead = false;

function updateGameState(state) {
  if (!state) return;

  // Update players
  Object.entries(state.players || {}).forEach(([id, player]) => {
    if (!playerMeshes[id]) {
      // Create new player mesh with detailed model
      playerMeshes[id] = createDetailedPlayerModel(player);
      scene.add(playerMeshes[id]);

      // Add to colliders if not the current player
      if (id !== socket.id) {
        colliders.push({
          type: "player",
          id: id,
          mesh: playerMeshes[id],
          radius: 1.0, // Player collision radius
        });
      }

      // Create player name label
      createPlayerNameLabel(id, player.name);

      // Initialize bot position tracking
      if (id !== socket.id && id.startsWith("bot-")) {
        botPositions[id] = {
          current: new THREE.Vector3().copy(player.position),
          target: new THREE.Vector3().copy(player.position),
        };
      }
    }

    // Check if current player died
    if (id === socket.id) {
      // If player was alive and is now dead, show death modal
      if (!playerIsDead && player.health <= 0) {
        playerIsDead = true;
        showDeathModal(state);
      }
      // If player was dead and is now alive (respawned), hide death modal
      else if (playerIsDead && player.health > 0) {
        playerIsDead = false;
        hideDeathModal();
      }
    }

    // Update position
    if (player.position) {
      if (id === socket.id) {
        // For the current player, directly update position
        playerMeshes[id].position.set(
          player.position.x,
          player.position.y,
          player.position.z
        );
      } else if (id.startsWith("bot-")) {
        // For bots, smoothly interpolate position
        if (botPositions[id]) {
          botPositions[id].target.set(
            player.position.x,
            player.position.y,
            player.position.z
          );
        }
      } else {
        // For other players, directly update position
        playerMeshes[id].position.set(
          player.position.x,
          player.position.y,
          player.position.z
        );

        // Update collider position
        const collider = colliders.find(
          (c) => c.type === "player" && c.id === id
        );
        if (collider) {
          collider.mesh.position.copy(player.position);
        }
      }

      // Update name label position
      updatePlayerNameLabel(id, player.position);
    }

    // Update rotation
    if (player.rotation) {
      playerMeshes[id].rotation.y = player.rotation.y;
    }

    // Update weapon
    if (player.weapon) {
      updatePlayerWeapon(id, player.weapon.type);
    }

    // Update our own view mode
    if (id === socket.id) {
      isThirdPerson = player.isThirdPerson;
      showStats = player.showStats;
      updateViewMode();
    }
  });

  // Remove disconnected players
  Object.keys(playerMeshes).forEach((id) => {
    if (!state.players || !state.players[id]) {
      scene.remove(playerMeshes[id]);
      delete playerMeshes[id];

      // Remove from colliders
      const colliderIndex = colliders.findIndex(
        (c) => c.type === "player" && c.id === id
      );
      if (colliderIndex !== -1) {
        colliders.splice(colliderIndex, 1);
      }

      // Remove name label
      removePlayerNameLabel(id);

      // Clean up bot position tracking
      if (botPositions[id]) {
        delete botPositions[id];
      }
    }
  });

  // Update weapons
  weaponMeshes.forEach((mesh) => scene.remove(mesh));
  weaponMeshes = [];

  // Remove weapon labels
  Object.keys(weaponLabels).forEach((id) => {
    document.body.removeChild(weaponLabels[id]);
  });
  weaponLabels = {};

  if (state.weapons) {
    state.weapons.forEach((weapon, index) => {
      if (weapon.position) {
        // Create detailed weapon model
        const weaponMesh = createWeaponModel(weapon.type);
        weaponMesh.position.set(
          weapon.position.x,
          weapon.position.y,
          weapon.position.z
        );
        weaponMesh.userData.weaponId = `weapon-${index}`;
        weaponMesh.userData.weaponType = weapon.type;
        weaponMeshes.push(weaponMesh);
        scene.add(weaponMesh);

        // Create weapon label
        createWeaponLabel(
          weaponMesh.userData.weaponId,
          weapon.type,
          weapon.position
        );
      }
    });
  }

  // Update collectibles
  // Remove existing collectible labels
  Object.keys(collectibleLabels).forEach((id) => {
    document.body.removeChild(collectibleLabels[id]);
  });
  collectibleLabels = {};

  if (state.collectibles) {
    state.collectibles.forEach((collectible, index) => {
      if (collectible.position) {
        // Create collectible model based on type
        let collectibleMesh;

        switch (collectible.type) {
          case "healthKit":
            collectibleMesh = createHealthKitModel();
            break;
          case "armor":
            collectibleMesh = createArmorModel();
            break;
          case "helmet":
            collectibleMesh = createHelmetModel();
            break;
          case "shield":
            collectibleMesh = createShieldModel();
            break;
          default:
            collectibleMesh = new THREE.Mesh(
              new THREE.BoxGeometry(0.5, 0.5, 0.5),
              new THREE.MeshStandardMaterial({ color: 0xffffff })
            );
        }

        collectibleMesh.position.set(
          collectible.position.x,
          collectible.position.y,
          collectible.position.z
        );
        collectibleMesh.userData.collectibleId = `collectible-${index}`;
        collectibleMesh.userData.collectibleType = collectible.type;
        scene.add(collectibleMesh);

        // Create collectible label
        createCollectibleLabel(
          collectibleMesh.userData.collectibleId,
          collectible.type,
          collectible.position
        );
      }
    });
  }

  // Update birds
  birdMeshes.forEach((mesh) => scene.remove(mesh));
  birdMeshes = [];

  // Remove bird colliders
  colliders = colliders.filter((c) => c.type !== "bird");

  if (state.birds) {
    state.birds.forEach((bird, index) => {
      if (bird.position && bird.health > 0) {
        // Create larger bird model
        const birdGroup = new THREE.Group();

        // Bird body (larger)
        const bodyGeometry = new THREE.SphereGeometry(1, 16, 16); // Increased size
        const bodyMaterial = new THREE.MeshStandardMaterial({
          color: bird.color || 0x000080,
        });
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        body.castShadow = true;
        birdGroup.add(body);

        // Bird wings
        const wingGeometry = new THREE.BoxGeometry(3, 0.2, 1); // Wider wings
        const wingMaterial = new THREE.MeshStandardMaterial({
          color: bird.color || 0x000080,
        });

        const leftWing = new THREE.Mesh(wingGeometry, wingMaterial);
        leftWing.position.set(-1.5, 0, 0);
        leftWing.castShadow = true;
        birdGroup.add(leftWing);

        const rightWing = new THREE.Mesh(wingGeometry, wingMaterial);
        rightWing.position.set(1.5, 0, 0);
        rightWing.castShadow = true;
        birdGroup.add(rightWing);

        // Bird head
        const headGeometry = new THREE.SphereGeometry(0.5, 16, 16);
        const headMaterial = new THREE.MeshStandardMaterial({
          color: bird.color || 0x000080,
        });
        const head = new THREE.Mesh(headGeometry, headMaterial);
        head.position.set(0, 0, 1);
        head.castShadow = true;
        birdGroup.add(head);

        // Position the bird
        birdGroup.position.set(
          bird.position.x,
          bird.position.y,
          bird.position.z
        );

        if (bird.rotation) {
          birdGroup.rotation.set(
            bird.rotation.x,
            bird.rotation.y,
            bird.rotation.z
          );
        }

        birdMeshes.push(birdGroup);
        scene.add(birdGroup);

        // Add to colliders
        colliders.push({
          type: "bird",
          id: `bird-${index}`,
          mesh: birdGroup,
          radius: 1.5, // Bird collision radius
        });
      }
    });
  }

  // Update chickens
  chickenMeshes.forEach((mesh) => scene.remove(mesh));
  chickenMeshes = [];

  // Remove chicken colliders
  colliders = colliders.filter((c) => c.type !== "chicken");

  if (state.chickens) {
    state.chickens.forEach((chicken, index) => {
      if (chicken.position && chicken.health > 0) {
        const chickenGroup = new THREE.Group();

        // Chicken body
        const bodyGeometry = new THREE.BoxGeometry(0.8, 0.8, 1.2);
        const bodyMaterial = new THREE.MeshStandardMaterial({
          color: chicken.color || 0xffffff,
        });
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        body.castShadow = true;
        chickenGroup.add(body);

        // Chicken head
        const headGeometry = new THREE.SphereGeometry(0.4, 16, 16);
        const headMaterial = new THREE.MeshStandardMaterial({
          color: chicken.color === "#FFFFFF" ? 0xff0000 : 0xffffff,
        });
        const head = new THREE.Mesh(headGeometry, headMaterial);
        head.position.set(0, 0.5, 0.6);
        head.castShadow = true;
        chickenGroup.add(head);

        // Chicken legs
        const legGeometry = new THREE.CylinderGeometry(0.05, 0.05, 0.5, 8);
        const legMaterial = new THREE.MeshStandardMaterial({ color: 0xffff00 }); // Yellow legs

        const leftLeg = new THREE.Mesh(legGeometry, legMaterial);
        leftLeg.position.set(-0.3, -0.6, 0);
        leftLeg.castShadow = true;
        chickenGroup.add(leftLeg);

        const rightLeg = new THREE.Mesh(legGeometry, legMaterial);
        rightLeg.position.set(0.3, -0.6, 0);
        rightLeg.castShadow = true;
        chickenGroup.add(rightLeg);

        // Position the chicken
        chickenGroup.position.set(
          chicken.position.x,
          chicken.position.y + 0.4, // Raise slightly above ground
          chicken.position.z
        );

        if (chicken.rotation) {
          chickenGroup.rotation.set(
            chicken.rotation.x,
            chicken.rotation.y,
            chicken.rotation.z
          );
        }

        chickenMeshes.push(chickenGroup);
        scene.add(chickenGroup);

        // Add to colliders
        colliders.push({
          type: "chicken",
          id: `chicken-${index}`,
          mesh: chickenGroup,
          radius: 1.0, // Chicken collision radius
        });
      }
    });
  }

  // Update walls
  wallMeshes.forEach((mesh) => scene.remove(mesh));
  wallMeshes = [];

  if (state.walls) {
    state.walls.forEach((wall) => {
      const geometry = new THREE.BoxGeometry(
        wall.size.width,
        wall.size.height,
        wall.size.depth
      );
      const material = new THREE.MeshStandardMaterial({ color: wall.color });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(wall.position.x, wall.position.y, wall.position.z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      wallMeshes.push(mesh);
      scene.add(mesh);
    });
  }

  // Update blood splashes
  bloodSplashes.forEach((mesh) => scene.remove(mesh));
  bloodSplashes = [];

  if (state.bloodSplashes) {
    state.bloodSplashes.forEach((splash) => {
      const geometry = new THREE.CircleGeometry(1, 16);
      const material = new THREE.MeshBasicMaterial({ color: 0xff0000 });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(
        splash.position.x,
        splash.position.y + 0.1, // Slightly above ground
        splash.position.z
      );
      mesh.rotation.x = -Math.PI / 2; // Flat on ground
      bloodSplashes.push(mesh);
      scene.add(mesh);
    });
  }

  // Update UI
  updateUI(state);
}

function createPlayerNameLabel(id, name) {
  // Create a div for the player name
  const label = document.createElement("div");
  label.className = "player-label";
  label.textContent = name;
  label.style.position = "absolute";
  label.style.color = "white";
  label.style.backgroundColor = "rgba(0, 0, 0, 0.5)";
  label.style.padding = "2px 5px";
  label.style.borderRadius = "3px";
  label.style.fontSize = "12px";
  label.style.fontWeight = "bold";
  label.style.pointerEvents = "none";
  label.style.zIndex = "1000";
  label.style.textAlign = "center";
  label.style.transform = "translate(-50%, -100%)";

  // Hide initially until position is updated
  label.style.display = "none";

  document.body.appendChild(label);
  playerNameLabels[id] = label;
}

function updatePlayerNameLabel(id, position) {
  if (!playerNameLabels[id]) return;

  // Don't show label for current player in FPP
  if (id === socket.id && !isThirdPerson) {
    playerNameLabels[id].style.display = "none";
    return;
  }

  // Convert 3D position to screen coordinates
  const screenPosition = toScreenPosition(position, camera);

  // Only show if in front of camera and within view frustum
  if (screenPosition.z > 0 && isInViewport(screenPosition)) {
    // Calculate distance to player
    const distance = calculateDistance(
      { x: camera.position.x, y: camera.position.y, z: camera.position.z },
      position
    );

    // Only show names for players within 50 units
    if (distance < 50) {
      playerNameLabels[id].style.display = "block";
      playerNameLabels[id].style.left = screenPosition.x + "px";
      playerNameLabels[id].style.top = screenPosition.y - 30 + "px"; // Offset above player

      // Fade out with distance
      const opacity = Math.max(0, Math.min(1, 1 - distance / 50));
      playerNameLabels[id].style.opacity = opacity.toString();
    } else {
      playerNameLabels[id].style.display = "none";
    }
  } else {
    playerNameLabels[id].style.display = "none";
  }
}

// Check if a point is within the viewport
function isInViewport(point) {
  return (
    point.x >= 0 &&
    point.x <= window.innerWidth &&
    point.y >= 0 &&
    point.y <= window.innerHeight
  );
}

function removePlayerNameLabel(id) {
  if (playerNameLabels[id]) {
    document.body.removeChild(playerNameLabels[id]);
    delete playerNameLabels[id];
  }
}

function createWeaponLabel(id, type, position) {
  // Create a div for the weapon name
  const label = document.createElement("div");
  label.className = "weapon-label";
  label.textContent = `${type.toUpperCase()} [P]`;
  label.style.position = "absolute";
  label.style.color = "yellow";
  label.style.backgroundColor = "rgba(0, 0, 0, 0.5)";
  label.style.padding = "2px 5px";
  label.style.borderRadius = "3px";
  label.style.fontSize = "10px";
  label.style.fontWeight = "bold";
  label.style.pointerEvents = "none";
  label.style.zIndex = "1000";
  label.style.textAlign = "center";
  label.style.transform = "translate(-50%, -100%)";

  // Hide initially until position is updated
  label.style.display = "none";

  document.body.appendChild(label);
  weaponLabels[id] = label;

  // Update position
  updateWeaponLabel(id, position);
}

function updateWeaponLabel(id, position) {
  if (!weaponLabels[id]) return;

  // Convert 3D position to screen coordinates
  const screenPosition = toScreenPosition(position, camera);

  // Calculate distance to weapon
  const distance = calculateDistance(
    { x: camera.position.x, y: camera.position.y, z: camera.position.z },
    position
  );

  // Only show if in front of camera, within view frustum, and within 10 meters
  if (screenPosition.z > 0 && isInViewport(screenPosition) && distance < 10) {
    weaponLabels[id].style.display = "block";
    weaponLabels[id].style.left = screenPosition.x + "px";
    weaponLabels[id].style.top = screenPosition.y - 20 + "px"; // Offset above weapon

    // Fade out with distance
    const opacity = Math.max(0, Math.min(1, 1 - distance / 10));
    weaponLabels[id].style.opacity = opacity.toString();
  } else {
    weaponLabels[id].style.display = "none";
  }
}

function toScreenPosition(position, camera) {
  const vector = new THREE.Vector3();
  vector.copy(position);
  vector.y += 2; // Offset above the object

  // Project the 3D position to 2D screen space
  vector.project(camera);

  // Convert to screen coordinates
  const x = (vector.x * 0.5 + 0.5) * window.innerWidth;
  const y = (vector.y * -0.5 + 0.5) * window.innerHeight;

  return {
    x: x,
    y: y,
    z: vector.z, // Keep z to check if in front of camera
  };
}

function updateViewMode() {
  if (isThirdPerson) {
    // Third-person view
    playerModel.visible = true;

    // Show helmet parts
    helmetParts.forEach((part) => {
      part.visible = true;
      if (part.material) {
        part.material.opacity = 1.0;
      }
    });

    // Hide first-person gun
    if (camera.children.length > 0) {
      camera.children[0].visible = false;
    }
  } else {
    // First-person view
    playerModel.visible = false;

    // Hide helmet parts completely
    helmetParts.forEach((part) => {
      part.visible = false;
      if (part.material) {
        part.material.opacity = 0.0;
      }
    });

    // Show first-person gun
    if (camera.children.length > 0) {
      camera.children[0].visible = true;
    }

    // Ensure player model is far away to prevent any part from being visible
    playerModel.position.y = -10000; // Move extremely far away
  }

  // Update stats visibility
  document.getElementById("stats").style.display = showStats ? "block" : "none";
  document.getElementById("health").style.display = showStats
    ? "block"
    : "none";
}

function updateUI(state) {
  if (!state || !state.players || !socket) return;

  const player = state.players[socket.id];
  if (player) {
    // Update health bar
    document.getElementById("healthBar").style.width = `${player.health}%`;

    // Update stats with current weapon name
    const weaponName = player.weapon.type.toUpperCase();
    document.getElementById("stats").textContent =
      `${weaponName} | Health: ${player.health}% | Armor: ${player.armor}% | Shield: ${player.shield}% | ` +
      `Kills: ${player.kills} | Deaths: ${player.deaths} | ` +
      `Players: ${state.alivePlayers}/${state.totalPlayers}`;
  }
}

function onKeyDown(event) {
  if (playerIsDead) return; // Ignore input if player is dead

  if (!gameState || !gameState.players || !socket) return;

  const player = gameState.players[socket.id];
  if (!player || player.health <= 0) return;

  switch (event.code) {
    case "ArrowUp":
    case "KeyW":
      moveForward = true;
      break;
    case "ArrowDown":
    case "KeyS":
      moveBackward = true;
      break;
    case "ArrowLeft":
    case "KeyA":
      moveLeft = true;
      break;
    case "ArrowRight":
    case "KeyD":
      moveRight = true;
      break;
    case "Space":
      shoot();
      break;
    case "KeyZ":
      toggleZoom(true);
      break;
    case "KeyX":
      toggleZoom(false);
      break;
    case "KeyH":
      useHealthKit();
      break;
    case "KeyC":
      useShield();
      break;
    case "ShiftLeft":
      if (canJump) {
        velocity.y = JUMP_FORCE;
        canJump = false;
      }
      break;
    case "KeyV":
      // toggleView();
      break;
    case "KeyB":
      toggleStats();
      break;
    case "KeyM":
      toggleVolumeControl();
      break;
    case "KeyP":
      pickupWeapon();
      break;
  }
}

function onKeyUp(event) {
  if (playerIsDead) return; // Ignore input if player is dead

  switch (event.code) {
    case "ArrowUp":
    case "KeyW":
      moveForward = false;
      break;
    case "ArrowDown":
    case "KeyS":
      moveBackward = false;
      break;
    case "ArrowLeft":
    case "KeyA":
      moveLeft = false;
      break;
    case "ArrowRight":
    case "KeyD":
      moveRight = false;
      break;
  }
}

function onMouseDown(event) {
  if (playerIsDead) return; // Ignore input if player is dead

  const player = gameState.players[socket.id];
  if (!player || player.health <= 0) return;

  if (event.button === 0) {
    // Left click for shooting
    if (player.weapon) {
      shoot();
    }
  } else if (event.button === 2) {
    // Right click for zooming
    toggleZoom(!isZooming);
  }
}

function onMouseUp(event) {
  if (playerIsDead) return; // Ignore input if player is dead

  if (event.button === 2) {
    // Right click
    toggleZoom(false);
  }
}

function toggleZoom(zoom) {
  isZooming = zoom;
  document.getElementById("zoomOverlay").style.display = isZooming
    ? "block"
    : "none";
  if (isZooming) {
    camera.fov = 45;
  } else {
    camera.fov = 75;
  }
  camera.updateProjectionMatrix();
}

function toggleView() {
  // Check if cooldown has elapsed
  const currentTime = performance.now() / 1000;
  if (currentTime < toggleViewCooldown) {
    return; // Still in cooldown
  }

  // Set cooldown
  toggleViewCooldown = currentTime + 1; // 1 second cooldown

  // If already transitioning, don't start another transition
  if (viewTransitioning) {
    return;
  }

  // Store current camera positions for smooth transition
  if (isThirdPerson) {
    // Switching from TPP to FPP
    tppCameraPosition.copy(camera.position);
    tppCameraRotation.copy(camera.rotation);

    // Calculate the FPP position (at player model position)
    fppCameraPosition.copy(playerModel.position);
    fppCameraPosition.y = PLAYER_HEIGHT; // Set proper height

    // Keep the same rotation
    fppCameraRotation.copy(camera.rotation);
  } else {
    // Switching from FPP to TPP
    fppCameraPosition.copy(camera.position);
    fppCameraRotation.copy(camera.rotation);

    // Calculate the TPP position (behind player)
    const cameraDirection = new THREE.Vector3();
    camera.getWorldDirection(cameraDirection);

    tppCameraPosition.copy(camera.position);
    tppCameraPosition.sub(
      cameraDirection.multiplyScalar(THIRD_PERSON_DISTANCE)
    );
    tppCameraPosition.y += 2; // Look from above

    // Keep the same rotation
    tppCameraRotation.copy(camera.rotation);
  }

  // Start transition
  viewTransitioning = true;
  viewTransitionTime = 0;

  // Toggle the view mode flag
  socket.emit("toggleView");
}

function toggleStats() {
  socket.emit("toggleStats");
}

function toggleVolumeControl() {
  const volumeControl = document.getElementById("volumeControl");
  volumeControl.style.display =
    volumeControl.style.display === "none" ? "block" : "none";
}

function shoot() {
  // Play shoot sound
  if (shootSound) {
    shootSound.currentTime = 0;
    shootSound
      .play()
      .catch((e) => console.error("Error playing shoot sound:", e));
  }

  // Create and fire a bullet
  createBullet();

  const direction = new THREE.Vector3();
  camera.getWorldDirection(direction);

  // Try to send via WebRTC first for lower latency
  const directionData = { x: direction.x, y: direction.y, z: direction.z };

  // Always send to server for authoritative hit detection
  socket.emit("shoot", directionData);

  // Also broadcast to peers directly for faster visual feedback
  if (rtcManager) {
    shootViaPeers(directionData);
  }
}

// Function to handle shots from other players via WebRTC
function handlePeerShot(peerId, direction) {
  // Create visual effect for the shot immediately
  if (gameState && gameState.players && gameState.players[peerId]) {
    const player = gameState.players[peerId];
    createRemotePlayerBullet(player.position, direction);

    // Play remote shot sound
    if (shootSound) {
      // Create a cloned sound for simultaneous playing
      const remoteShootSound = shootSound.cloneNode();
      remoteShootSound.volume = shootSound.volume * 0.7; // Slightly quieter
      remoteShootSound
        .play()
        .catch((e) => console.error("Error playing remote shot sound:", e));
    }
  }
}

function createBullet() {
  // Get current weapon type from player
  if (gameState && gameState.players && socket) {
    const player = gameState.players[socket.id];
    if (player && player.weapon) {
      currentWeaponType = player.weapon.type;
    }
  }

  // Get bullet range based on weapon type
  const bulletRange = WEAPON_RANGES[currentWeaponType] || 100;

  // Create bullet geometry
  const bulletGeometry = new THREE.CylinderGeometry(0.05, 0.05, 0.2, 8);
  const bulletMaterial = new THREE.MeshStandardMaterial({ color: 0xffd700 }); // Gold/yellow chrome
  const bullet = new THREE.Mesh(bulletGeometry, bulletMaterial);

  // Position bullet at camera position
  bullet.position.copy(camera.position);

  // Get camera direction
  const bulletDirection = new THREE.Vector3();
  camera.getWorldDirection(bulletDirection);

  // Adjust bullet position to appear from gun
  if (isThirdPerson) {
    // In third-person, fire from player model
    bullet.position.y -= 0.5;
    bullet.position.add(bulletDirection.multiplyScalar(1));
  } else {
    // In first-person, fire from camera/gun position
    bullet.position.y -= 0.2;
    bullet.position.add(bulletDirection.multiplyScalar(1));
  }

  // Rotate bullet to align with direction
  bullet.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    bulletDirection.normalize()
  );

  // Add bullet to scene
  scene.add(bullet);

  // Store bullet with its creation time, direction, and range
  activeBullets.push({
    mesh: bullet,
    direction: bulletDirection,
    createdAt: Date.now(),
    initialPosition: bullet.position.clone(),
    range: bulletRange,
    weaponType: currentWeaponType,
  });
}

function updateBullets(deltaTime) {
  // Move bullets forward
  const currentTime = Date.now();
  const bulletsToRemove = [];

  activeBullets.forEach((bullet, index) => {
    // Move bullet in its direction
    bullet.mesh.position.add(
      bullet.direction.clone().multiplyScalar(BULLET_SPEED * deltaTime)
    );

    // Check if bullet has expired by time
    if (currentTime - bullet.createdAt > BULLET_LIFETIME) {
      bulletsToRemove.push(index);
      scene.remove(bullet.mesh);
      return;
    }

    // Check if bullet has exceeded its range
    const distanceTraveled = bullet.mesh.position.distanceTo(
      bullet.initialPosition
    );
    if (distanceTraveled > bullet.range) {
      bulletsToRemove.push(index);
      scene.remove(bullet.mesh);
      return;
    }

    // Check for collisions with hurdles
    for (let i = 0; i < hurdleMeshes.length; i++) {
      const hurdle = hurdleMeshes[i];
      const distance = bullet.mesh.position.distanceTo(hurdle.position);

      if (distance < 3) {
        // Approximate hurdle size + buffer
        bulletsToRemove.push(index);
        scene.remove(bullet.mesh);

        // Add impact effect
        createImpactEffect(bullet.mesh.position.clone());
        return;
      }
    }

    // Check for collisions with birds
    if (gameState && gameState.birds) {
      for (let i = 0; i < gameState.birds.length; i++) {
        const bird = gameState.birds[i];
        if (bird.health <= 0) continue; // Skip already dead birds

        const birdPosition = new THREE.Vector3(
          bird.position.x,
          bird.position.y,
          bird.position.z
        );
        const distance = bullet.mesh.position.distanceTo(birdPosition);

        if (distance < 2) {
          // Bird collision radius
          // Kill the bird
          bird.health = 0;

          // Add blood splash
          createBloodSplash(birdPosition);

          // Remove bullet
          bulletsToRemove.push(index);
          scene.remove(bullet.mesh);
          return;
        }
      }
    }

    // Check for collisions with chickens
    if (gameState && gameState.chickens) {
      for (let i = 0; i < gameState.chickens.length; i++) {
        const chicken = gameState.chickens[i];
        if (chicken.health <= 0) continue; // Skip already dead chickens

        const chickenPosition = new THREE.Vector3(
          chicken.position.x,
          chicken.position.y,
          chicken.position.z
        );
        const distance = bullet.mesh.position.distanceTo(chickenPosition);

        if (distance < 1.5) {
          // Chicken collision radius
          // Kill the chicken
          chicken.health = 0;

          // Add blood splash
          createBloodSplash(chickenPosition);

          // Remove bullet
          bulletsToRemove.push(index);
          scene.remove(bullet.mesh);
          return;
        }
      }
    }
  });

  // Remove expired bullets (in reverse order to avoid index issues)
  for (let i = bulletsToRemove.length - 1; i >= 0; i--) {
    activeBullets.splice(bulletsToRemove[i], 1);
  }
}

function createBloodSplash(position) {
  // Create a blood splash effect
  const splashGeometry = new THREE.CircleGeometry(1, 16);
  const splashMaterial = new THREE.MeshBasicMaterial({
    color: 0xff0000,
    transparent: true,
    opacity: 0.8,
  });
  const splash = new THREE.Mesh(splashGeometry, splashMaterial);

  // Position slightly above ground to avoid z-fighting
  splash.position.set(position.x, position.y + 0.1, position.z);
  splash.rotation.x = -Math.PI / 2; // Flat on ground/surface

  scene.add(splash);

  // Add to blood splashes array for server sync
  if (socket) {
    socket.emit("addBloodSplash", {
      position: { x: position.x, y: position.y, z: position.z },
    });
  }

  // Remove after a few seconds
  setTimeout(() => {
    scene.remove(splash);
  }, 5000);
}

function createImpactEffect(position) {
  // Create a simple impact effect (particle burst)
  const particleCount = 8;
  const particles = [];

  for (let i = 0; i < particleCount; i++) {
    const particle = new THREE.Mesh(
      new THREE.SphereGeometry(0.05, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xffd700 })
    );

    particle.position.copy(position);
    scene.add(particle);

    // Random direction
    const direction = new THREE.Vector3(
      Math.random() * 2 - 1,
      Math.random() * 2 - 1,
      Math.random() * 2 - 1
    ).normalize();

    particles.push({
      mesh: particle,
      direction: direction,
      speed: Math.random() * 5 + 5,
      life: 500, // milliseconds
    });

    // Remove particles after a short time
    setTimeout(() => {
      scene.remove(particle);
    }, 500);
  }
}

function useHealthKit() {
  socket.emit("useHealthKit");
}

function useShield() {
  socket.emit("useShield");
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function playFootstepSound() {
  const now = Date.now();
  if (
    now - lastStepTime > stepInterval &&
    (moveForward || moveBackward || moveLeft || moveRight)
  ) {
    if (footstepSound) {
      footstepSound.currentTime = 0;
      footstepSound
        .play()
        .catch((e) => console.error("Error playing footstep sound:", e));
    }
    lastStepTime = now;
  }
}

// Add a frame rate limiter and performance monitoring
let frameCounter = 0;
let lastPerformanceCheck = performance.now();
let fpsHistory = [];
const MAX_FPS_HISTORY = 60; // Keep track of last 60 frames
let isLowPerformanceMode = false;

// Performance optimization function
function optimizeForPerformance() {
  // Calculate average FPS
  const totalFps = fpsHistory.reduce((sum, fps) => sum + fps, 0);
  const averageFps = totalFps / fpsHistory.length;

  // If FPS is consistently low, reduce visual effects
  if (averageFps < 30 && !isLowPerformanceMode) {
    console.log("Enabling low performance mode");
    isLowPerformanceMode = true;

    // Reduce fog distance
    scene.fog.near = 50;
    scene.fog.far = 100;

    // Reduce max visible distance
    camera.far = 100;
    camera.updateProjectionMatrix();

    // Reduce shadow quality
    if (renderer.shadowMap.enabled) {
      renderer.shadowMap.type = THREE.BasicShadowMap;
    }
  }
  // Return to normal if performance improves
  else if (averageFps > 45 && isLowPerformanceMode) {
    console.log("Disabling low performance mode");
    isLowPerformanceMode = false;

    // Restore normal fog
    scene.fog.near = 100;
    scene.fog.far = MAX_VISIBLE_DISTANCE;

    // Restore normal visible distance
    camera.far = MAX_VISIBLE_DISTANCE;
    camera.updateProjectionMatrix();

    // Restore shadow quality
    if (renderer.shadowMap.enabled) {
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    }
  }
}

// Modify the animate function
function animate() {
  requestAnimationFrame(animate);

  // Calculate delta time
  const currentTime = performance.now();
  const deltaTime = Math.min((currentTime - lastFrameTime) / 1000, 0.1); // Limit delta to 100ms
  lastFrameTime = currentTime;

  // Track FPS for performance monitoring
  const fps = 1 / deltaTime;
  frameCounter++;
  fpsHistory.push(fps);
  if (fpsHistory.length > MAX_FPS_HISTORY) {
    fpsHistory.shift();
  }

  // Check performance every second
  if (currentTime - lastPerformanceCheck > 1000) {
    lastPerformanceCheck = currentTime;
    optimizeForPerformance();
  }

  // Update FPS counter
  updateFPSCounter(deltaTime);

  // Apply gravity
  velocity.y -= GRAVITY * deltaTime;
  camera.position.y += velocity.y * deltaTime;

  // Ground collision
  if (camera.position.y < PLAYER_HEIGHT) {
    velocity.y = 0;
    camera.position.y = PLAYER_HEIGHT;
    canJump = true;
  }

  // Movement
  direction.z = Number(moveForward) - Number(moveBackward);
  direction.x = Number(moveRight) - Number(moveLeft);
  direction.normalize();

  const speed = SPRINT_SPEED * deltaTime;

  // Only move if we have direction
  if (moveForward || moveBackward || moveLeft || moveRight) {
    // Store current position before movement
    const oldPosition = camera.position.clone();

    // Apply movement
    if (moveForward || moveBackward) controls.moveForward(direction.z * speed);
    if (moveLeft || moveRight) controls.moveRight(direction.x * speed);

    // Skip collision detection in low performance mode
    if (!isLowPerformanceMode) {
      // Check for collisions with hurdles, walls, and entities
      if (
        checkHurdleCollisions() ||
        checkWallCollisions() ||
        checkEntityCollisions()
      ) {
        // If collision detected, revert to old position
        camera.position.copy(oldPosition);
      }
    } else {
      // Simplified collision detection for low performance mode
      // Only check walls which are essential
      if (checkWallCollisions()) {
        camera.position.copy(oldPosition);
      }
    }

    // Add camera shake for walking effect (reduced in low performance mode)
    if (!isLowPerformanceMode) {
      cameraShake = Math.sin(Date.now() * 0.01) * 0.05;
      camera.position.y += cameraShake;
    }

    // Play footstep sound more efficiently
    if (frameCounter % 20 === 0) {
      // Only check every 20 frames
      playFootstepSound();
    }
  }

  // Update bullets
  updateBullets(deltaTime);

  // Update bot positions with interpolation
  updateBotPositions(deltaTime);

  // Update bot shooting
  updateBotShooting();

  // Update weapon labels
  Object.keys(weaponLabels).forEach((id, index) => {
    if (weaponMeshes[index]) {
      updateWeaponLabel(id, weaponMeshes[index].position);
    }
  });

  // Update collectible labels
  Object.keys(collectibleLabels).forEach((id) => {
    const collectibleMesh = scene.getObjectByProperty(
      "userData.collectibleId",
      id
    );
    if (collectibleMesh) {
      updateCollectibleLabel(id, collectibleMesh.position);
    }
  });

  // Update third-person view
  if (isThirdPerson) {
    playerModel.position.copy(camera.position);

    // Get camera direction
    const cameraDirection = new THREE.Vector3();
    camera.getWorldDirection(cameraDirection);

    // Position camera behind player
    camera.position.sub(cameraDirection.multiplyScalar(THIRD_PERSON_DISTANCE));
    camera.position.y += 2; // Look from above
  } else {
    // In first-person mode, ensure helmet is not visible
    if (helmetParts.length > 0) {
      helmetParts.forEach((part) => {
        part.visible = false;
        if (part.material) {
          part.material.opacity = 0.0;
        }
      });
    }

    // Keep player model far away in FPP
    playerModel.position.y = -10000;
  }

  // Update server
  if (socket && socket.connected) {
    const playerUpdate = {
      position: {
        x: camera.position.x,
        y: camera.position.y,
        z: camera.position.z,
      },
      rotation: {
        x: camera.rotation.x,
        y: camera.rotation.y,
        z: camera.rotation.z,
      },
      isZooming: isZooming,
      zoomLevel: zoomLevel,
    };

    // Try to send position via WebRTC first
    if (rtcManager && rtcManager.getConnectedPeerCount() > 0) {
      // Only broadcast position via WebRTC to reduce server load
      broadcastPositionViaPeers();

      // Still send full update to server but at a reduced rate
      // We use a counter to throttle updates to server while keeping smooth P2P updates
      positionUpdateCounter = (positionUpdateCounter + 1) % 6; // Send to server every 6 frames (10 updates/sec)
      if (positionUpdateCounter === 0) {
        socket.emit("updatePlayer", playerUpdate);
      }
    } else {
      // No WebRTC peers, send directly to server
      socket.emit("updatePlayer", playerUpdate);
    }
  }

  renderer.render(scene, camera);
}

// Add a counter for throttling position updates to server
let positionUpdateCounter = 0;

function updateFPSCounter(deltaTime) {
  const fps = Math.round(1 / deltaTime);
  const fpsCounter = document.getElementById("fpsCounter");
  if (fpsCounter) {
    fpsCounter.textContent = `FPS: ${fps} | Objects: ${scene.children.length}`;
  }
}

function updateBotPositions(deltaTime) {
  // Smoothly interpolate bot positions
  Object.keys(botPositions).forEach((botId) => {
    const bot = botPositions[botId];
    const playerMesh = playerMeshes[botId];

    if (bot && playerMesh) {
      // Interpolate position
      bot.current.lerp(bot.target, INTERPOLATION_SPEED);

      // Apply interpolated position
      playerMesh.position.copy(bot.current);

      // Calculate movement direction for animation
      const movementDirection = new THREE.Vector3().subVectors(
        bot.target,
        bot.current
      );

      // If bot is moving, animate legs
      if (movementDirection.length() > 0.01) {
        // Animate legs
        playerMesh.children.forEach((child) => {
          if (child.userData.isLeg) {
            // Simple leg animation
            child.rotation.x = Math.sin(Date.now() * 0.01 * SPRINT_SPEED) * 0.5;
          }
        });
      }
    }
  });
}

function checkHurdleCollisions() {
  const playerPosition = camera.position;

  // Check against all hurdle colliders
  for (const collider of colliders) {
    if (collider.type === "hurdle") {
      const bounds = collider.bounds;

      // Check if player is inside the hurdle bounds
      if (
        playerPosition.x >= bounds.minX &&
        playerPosition.x <= bounds.maxX &&
        playerPosition.y >= bounds.minY &&
        playerPosition.y <= bounds.maxY &&
        playerPosition.z >= bounds.minZ &&
        playerPosition.z <= bounds.maxZ
      ) {
        return true; // Collision detected
      }
    }
  }

  return false; // No collision
}

function checkWallCollisions() {
  const playerPosition = camera.position;

  // Check against all wall colliders
  for (const collider of colliders) {
    if (collider.type === "wall") {
      const bounds = collider.bounds;

      // Check if player is inside or too close to the wall bounds
      if (
        playerPosition.x >= bounds.minX - WALL_BUFFER &&
        playerPosition.x <= bounds.maxX + WALL_BUFFER &&
        playerPosition.y >= bounds.minY &&
        playerPosition.y <= bounds.maxY &&
        playerPosition.z >= bounds.minZ - WALL_BUFFER &&
        playerPosition.z <= bounds.maxZ + WALL_BUFFER
      ) {
        return true; // Collision detected
      }
    }
  }

  // Check map boundaries directly (as a fallback)
  const halfSize = MAP_SIZE / 2;
  if (
    playerPosition.x > halfSize - WALL_BUFFER ||
    playerPosition.x < -halfSize + WALL_BUFFER ||
    playerPosition.z > halfSize - WALL_BUFFER ||
    playerPosition.z < -halfSize + WALL_BUFFER
  ) {
    return true; // Collision with map boundary
  }

  return false; // No collision
}

function checkEntityCollisions() {
  const playerPosition = camera.position;

  // Check against all entity colliders (players, bots, birds, chickens)
  for (const collider of colliders) {
    if (["player", "bird", "chicken"].includes(collider.type)) {
      // Skip if it's the current player
      if (collider.type === "player" && collider.id === socket.id) {
        continue;
      }

      const entityPosition = collider.mesh.position;
      const distance = Math.sqrt(
        Math.pow(playerPosition.x - entityPosition.x, 2) +
          Math.pow(playerPosition.z - entityPosition.z, 2)
      );

      // Check if player is too close to the entity
      if (distance < collider.radius + COLLISION_RADIUS) {
        return true; // Collision detected
      }
    }
  }

  return false; // No collision
}

function updateBotShooting() {
  if (!gameState || !gameState.players) return;

  const currentTime = Date.now();
  const playerIds = Object.keys(gameState.players);

  // Process each bot
  playerIds.forEach((botId) => {
    // Skip if not a bot or if it's the current player
    if (botId === socket.id || !botId.startsWith("bot-")) return;

    const bot = gameState.players[botId];
    if (!bot) return;

    // Check cooldown
    if (
      botLastShootTime[botId] &&
      currentTime - botLastShootTime[botId] < BOT_SHOOT_COOLDOWN
    ) {
      return;
    }

    // Find targets (players, other bots, birds, chickens)
    let closestTarget = null;
    let closestDistance = BOT_SHOOT_RANGE;

    // Check players
    playerIds.forEach((targetId) => {
      if (targetId === botId) return; // Don't target self

      const target = gameState.players[targetId];
      const distance = calculateDistance(bot.position, target.position);

      if (distance < closestDistance) {
        closestTarget = {
          type: "player",
          id: targetId,
          position: target.position,
        };
        closestDistance = distance;
      }
    });

    // Check birds
    if (gameState.birds) {
      gameState.birds.forEach((bird, index) => {
        if (bird.health <= 0) return;

        const distance = calculateDistance(bot.position, bird.position);
        if (distance < closestDistance) {
          closestTarget = { type: "bird", id: index, position: bird.position };
          closestDistance = distance;
        }
      });
    }

    // Check chickens
    if (gameState.chickens) {
      gameState.chickens.forEach((chicken, index) => {
        if (chicken.health <= 0) return;

        const distance = calculateDistance(bot.position, chicken.position);
        if (distance < closestDistance) {
          closestTarget = {
            type: "chicken",
            id: index,
            position: chicken.position,
          };
          closestDistance = distance;
        }
      });
    }

    // Shoot at target if found
    if (closestTarget) {
      // Calculate direction to target
      const direction = {
        x: closestTarget.position.x - bot.position.x,
        y: closestTarget.position.y - bot.position.y,
        z: closestTarget.position.z - bot.position.z,
      };

      // Normalize direction
      const length = Math.sqrt(
        direction.x * direction.x +
          direction.y * direction.y +
          direction.z * direction.z
      );
      direction.x /= length;
      direction.y /= length;
      direction.z /= length;

      // Bot shoots
      socket.emit("botShoot", { botId, direction });

      // Update last shoot time
      botLastShootTime[botId] = currentTime;
    }
  });
}

function calculateDistance(pos1, pos2) {
  const dx = pos2.x - pos1.x;
  const dy = pos2.y - pos1.y;
  const dz = pos2.z - pos1.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function updatePlayerWeapon(playerId, weaponType) {
  const playerGroup = playerMeshes[playerId];
  if (!playerGroup) return;

  // Remove existing weapon
  playerGroup.children.forEach((child) => {
    if (child.userData.isWeapon) {
      playerGroup.remove(child);
    }
  });

  // Create new weapon based on type
  let weaponMesh;

  switch (weaponType) {
    case "pistol":
      weaponMesh = createWeaponModel("pistol", 0.7); // Small scale
      break;
    case "shotgun":
      weaponMesh = createWeaponModel("shotgun", 1.0); // Medium scale
      break;
    case "rifle":
      weaponMesh = createWeaponModel("rifle", 1.0); // Medium scale
      break;
    case "sniper":
      weaponMesh = createWeaponModel("sniper", 1.2); // Large scale
      break;
    default:
      weaponMesh = createWeaponModel("pistol", 0.7);
  }

  // Position weapon in player's hand
  weaponMesh.position.set(0.6, 1.1, 0.4);
  weaponMesh.userData.isWeapon = true;

  // Add weapon to player
  playerGroup.add(weaponMesh);
}

function createWeaponModel(type, scale = 1.0) {
  const weaponGroup = new THREE.Group();

  let color, length, width, height;

  switch (type) {
    case "pistol":
      color = 0x000000;
      length = 0.6;
      width = 0.1;
      height = 0.2;
      break;
    case "shotgun":
      color = 0x222222;
      length = 0.8;
      width = 0.15;
      height = 0.25;
      break;
    case "rifle":
      color = 0x333333;
      length = 1.0;
      width = 0.12;
      height = 0.22;
      break;
    case "sniper":
      color = 0x444444;
      length = 1.2;
      width = 0.14;
      height = 0.24;
      break;
    default:
      color = 0x000000;
      length = 0.6;
      width = 0.1;
      height = 0.2;
  }

  // Scale dimensions
  length *= scale;
  width *= scale;
  height *= scale;

  // Gun body
  const gunBodyGeometry = new THREE.BoxGeometry(width, height, length);
  const gunBodyMaterial = new THREE.MeshStandardMaterial({ color });
  const gunBody = new THREE.Mesh(gunBodyGeometry, gunBodyMaterial);
  gunBody.castShadow = true;
  weaponGroup.add(gunBody);

  // Gun barrel
  const gunBarrelGeometry = new THREE.CylinderGeometry(
    width / 2,
    width / 2,
    length / 2,
    16
  );
  const gunBarrelMaterial = new THREE.MeshStandardMaterial({ color: 0x222222 });
  const gunBarrel = new THREE.Mesh(gunBarrelGeometry, gunBarrelMaterial);
  gunBarrel.rotation.x = Math.PI / 2;
  gunBarrel.position.z = length / 2 + length / 4;
  gunBarrel.castShadow = true;
  weaponGroup.add(gunBarrel);

  // Bullet (cylindrical)
  const bulletGeometry = new THREE.CylinderGeometry(0.05, 0.05, 0.2, 8);
  const bulletMaterial = new THREE.MeshStandardMaterial({ color: 0xffd700 }); // Gold/yellow chrome
  const bullet = new THREE.Mesh(bulletGeometry, bulletMaterial);
  bullet.rotation.x = Math.PI / 2;
  bullet.position.set(width + 0.1, 0, length / 4);
  bullet.castShadow = true;
  weaponGroup.add(bullet);

  return weaponGroup;
}

function createDetailedPlayerModel(player) {
  const playerGroup = new THREE.Group();

  // Head (spherical)
  const headGeometry = new THREE.SphereGeometry(0.4, 16, 16);
  const headMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff });
  const head = new THREE.Mesh(headGeometry, headMaterial);
  head.position.y = 1.8;
  head.castShadow = true;
  playerGroup.add(head);

  // Helmet (rounded at top, flat at bottom)
  const helmetGeometry = new THREE.SphereGeometry(
    0.45,
    16,
    16,
    0,
    Math.PI * 2,
    0,
    Math.PI / 2
  );
  const helmetMaterial = new THREE.MeshStandardMaterial({ color: 0x444444 });
  const helmet = new THREE.Mesh(helmetGeometry, helmetMaterial);
  helmet.position.y = 1.9;
  helmet.castShadow = true;
  helmet.userData.isHelmet = true; // Mark as helmet for hiding in FPP
  playerGroup.add(helmet);

  // Torso (cylindrical)
  const torsoGeometry = new THREE.CylinderGeometry(0.4, 0.4, 1, 16);
  const torsoMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff });
  const torso = new THREE.Mesh(torsoGeometry, torsoMaterial);
  torso.position.y = 1.1;
  torso.castShadow = true;
  playerGroup.add(torso);

  // Armor (rounded on sides, flat top/bottom)
  const armorGeometry = new THREE.CylinderGeometry(0.45, 0.45, 1.1, 16);
  const armorMaterial = new THREE.MeshStandardMaterial({ color: 0x444444 });
  const armor = new THREE.Mesh(armorGeometry, armorMaterial);
  armor.position.y = 1.1;
  armor.castShadow = true;
  playerGroup.add(armor);

  // Arms (cylindrical)
  const armGeometry = new THREE.CylinderGeometry(0.15, 0.15, 0.8, 16);
  const armMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff });

  const leftArm = new THREE.Mesh(armGeometry, armMaterial);
  leftArm.position.set(-0.6, 1.1, 0);
  leftArm.rotation.z = Math.PI / 6;
  leftArm.castShadow = true;
  playerGroup.add(leftArm);

  const rightArm = new THREE.Mesh(armGeometry, armMaterial);
  rightArm.position.set(0.6, 1.1, 0);
  rightArm.rotation.z = -Math.PI / 6;
  rightArm.castShadow = true;
  playerGroup.add(rightArm);

  // Legs (cylindrical)
  const legGeometry = new THREE.CylinderGeometry(0.2, 0.2, 0.9, 16);
  const legMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff });

  const leftLeg = new THREE.Mesh(legGeometry, legMaterial);
  leftLeg.position.set(-0.25, 0.45, 0);
  leftLeg.castShadow = true;
  leftLeg.userData.isLeg = true; // Mark as leg for animation
  playerGroup.add(leftLeg);

  const rightLeg = new THREE.Mesh(legGeometry, legMaterial);
  rightLeg.position.set(0.25, 0.45, 0);
  rightLeg.castShadow = true;
  rightLeg.userData.isLeg = true; // Mark as leg for animation
  playerGroup.add(rightLeg);

  // Shield (flat rectangular)
  const shieldGeometry = new THREE.BoxGeometry(0.5, 0.8, 0.1);
  const shieldMaterial = new THREE.MeshStandardMaterial({ color: 0x444444 });
  const shield = new THREE.Mesh(shieldGeometry, shieldMaterial);
  shield.position.set(-0.6, 1.1, 0.3);
  shield.castShadow = true;
  playerGroup.add(shield);

  // Add weapon based on player's current weapon
  if (player && player.weapon) {
    const weaponMesh = createWeaponModel(player.weapon.type);
    weaponMesh.position.set(0.6, 1.1, 0.4);
    weaponMesh.userData.isWeapon = true;
    playerGroup.add(weaponMesh);
  }

  return playerGroup;
}

function createHealthKitModel() {
  const kitGroup = new THREE.Group();

  // Base (square cubical)
  const baseGeometry = new THREE.BoxGeometry(0.5, 0.5, 0.5);
  const baseMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff }); // White
  const base = new THREE.Mesh(baseGeometry, baseMaterial);
  base.castShadow = true;
  kitGroup.add(base);

  // Red cross (horizontal)
  const crossHGeometry = new THREE.BoxGeometry(0.4, 0.1, 0.1);
  const crossMaterial = new THREE.MeshStandardMaterial({ color: 0xff0000 }); // Red
  const crossH = new THREE.Mesh(crossHGeometry, crossMaterial);
  crossH.position.y = 0.26;
  crossH.castShadow = true;
  kitGroup.add(crossH);

  // Red cross (vertical)
  const crossVGeometry = new THREE.BoxGeometry(0.1, 0.1, 0.4);
  const crossV = new THREE.Mesh(crossVGeometry, crossMaterial);
  crossV.position.y = 0.26;
  crossV.castShadow = true;
  kitGroup.add(crossV);

  return kitGroup;
}

function createArmorModel() {
  // Armor (rounded on sides, flat top/bottom)
  const armorGeometry = new THREE.CylinderGeometry(0.3, 0.3, 0.6, 16);
  const armorMaterial = new THREE.MeshStandardMaterial({ color: 0x444444 }); // Dark gray
  const armor = new THREE.Mesh(armorGeometry, armorMaterial);
  armor.castShadow = true;

  return armor;
}

function createHelmetModel() {
  // Helmet (rounded at top, flat at bottom)
  const helmetGeometry = new THREE.SphereGeometry(
    0.3,
    16,
    16,
    0,
    Math.PI * 2,
    0,
    Math.PI / 2
  );
  const helmetMaterial = new THREE.MeshStandardMaterial({ color: 0x444444 }); // Dark gray
  const helmet = new THREE.Mesh(helmetGeometry, helmetMaterial);
  helmet.castShadow = true;

  return helmet;
}

function createShieldModel() {
  // Shield (flat rectangular)
  const shieldGeometry = new THREE.BoxGeometry(0.5, 0.8, 0.1);
  const shieldMaterial = new THREE.MeshStandardMaterial({ color: 0x444444 }); // Dark gray
  const shield = new THREE.Mesh(shieldGeometry, shieldMaterial);
  shield.castShadow = true;

  return shield;
}

function pickupWeapon() {
  if (!gameState || !gameState.players || !socket) return;

  const player = gameState.players[socket.id];
  if (!player) return;

  // Find closest weapon
  let closestWeapon = null;
  let closestDistance = 5; // Maximum pickup distance
  let closestIndex = -1;

  if (gameState.weapons) {
    gameState.weapons.forEach((weapon, index) => {
      if (weapon.position) {
        const distance = calculateDistance(player.position, weapon.position);

        if (distance < closestDistance) {
          closestWeapon = weapon;
          closestDistance = distance;
          closestIndex = index;
        }
      }
    });
  }

  // Check for weapons from dead players
  if (gameState.deadPlayerWeapons) {
    gameState.deadPlayerWeapons.forEach((weapon, index) => {
      if (weapon.position) {
        const distance = calculateDistance(player.position, weapon.position);

        if (distance < closestDistance) {
          closestWeapon = weapon;
          closestDistance = distance;
          closestIndex = index + 1000; // Offset to distinguish from regular weapons
        }
      }
    });
  }

  if (closestWeapon) {
    // Check if weapon is better than current weapon or same type
    const currentWeaponLevel = config.weaponStats[player.weapon.type].level;
    const newWeaponLevel = config.weaponStats[closestWeapon.type].level;

    if (newWeaponLevel > currentWeaponLevel) {
      // Pickup better weapon
      socket.emit("pickupWeapon", {
        weaponIndex: closestIndex,
        isDeadPlayerWeapon: closestIndex >= 1000,
      });
    } else {
      // Pickup different weapon (not better)
      socket.emit("pickupWeapon", {
        weaponIndex: closestIndex,
        isDeadPlayerWeapon: closestIndex >= 1000,
      });
    }
  }
}

function createCollectibleLabel(id, type, position) {
  // Create a div for the collectible name
  const label = document.createElement("div");
  label.className = "collectible-label";

  // Format the type name for display
  let displayName = type.replace(/([A-Z])/g, " $1").trim(); // Add spaces before capital letters
  displayName = displayName.charAt(0).toUpperCase() + displayName.slice(1); // Capitalize first letter

  label.textContent = `${displayName} [P]`;
  label.style.position = "absolute";
  label.style.color = "#00FFFF"; // Cyan color for collectibles
  label.style.backgroundColor = "rgba(0, 0, 0, 0.5)";
  label.style.padding = "2px 5px";
  label.style.borderRadius = "3px";
  label.style.fontSize = "10px";
  label.style.fontWeight = "bold";
  label.style.pointerEvents = "none";
  label.style.zIndex = "1000";
  label.style.textAlign = "center";
  label.style.transform = "translate(-50%, -100%)";

  // Hide initially until position is updated
  label.style.display = "none";

  document.body.appendChild(label);
  collectibleLabels[id] = label;

  // Update position
  updateCollectibleLabel(id, position);
}

function updateCollectibleLabel(id, position) {
  if (!collectibleLabels[id]) return;

  // Convert 3D position to screen coordinates
  const screenPosition = toScreenPosition(position, camera);

  // Calculate distance to collectible
  const distance = calculateDistance(
    { x: camera.position.x, y: camera.position.y, z: camera.position.z },
    position
  );

  // Only show if in front of camera, within view frustum, and within 10 meters
  if (screenPosition.z > 0 && isInViewport(screenPosition) && distance < 10) {
    collectibleLabels[id].style.display = "block";
    collectibleLabels[id].style.left = screenPosition.x + "px";
    collectibleLabels[id].style.top = screenPosition.y - 20 + "px"; // Offset above collectible

    // Fade out with distance
    const opacity = Math.max(0, Math.min(1, 1 - distance / 10));
    collectibleLabels[id].style.opacity = opacity.toString();
  } else {
    collectibleLabels[id].style.display = "none";
  }
}

// Make startGame function globally accessible
window.startGame = function () {
  const playerName = document.getElementById("playerName").value.trim();
  if (!playerName) {
    alert("Please enter your name");
    return;
  }

  // Hide login screen
  document.getElementById("login").style.display = "none";
  document.getElementById("loginOverlay").style.display = "none";

  // Lock pointer
  controls.lock();

  // Join the game
  socket.emit("join", playerName);

  // Track player join event
  if (analytics && socket) {
    analytics.trackPlayerJoin(socket.id, playerName);
  }
};

// Initialize when the page loads
init();

// Function to create a bullet for remote players (via WebRTC)
function createRemotePlayerBullet(playerPosition, direction) {
  // Create bullet geometry
  const bulletGeometry = new THREE.SphereGeometry(0.05, 8, 8);
  const bulletMaterial = new THREE.MeshBasicMaterial({ color: 0xffff00 });
  const bullet = new THREE.Mesh(bulletGeometry, bulletMaterial);

  // Set initial position at the player's position
  bullet.position.copy(playerPosition);

  // Adjust starting position to be in front of the player
  const bulletOffset = new THREE.Vector3(direction.x, direction.y, direction.z)
    .normalize()
    .multiplyScalar(0.5);
  bullet.position.add(bulletOffset);

  // Store bullet data
  const bulletData = {
    mesh: bullet,
    direction: new THREE.Vector3(
      direction.x,
      direction.y,
      direction.z
    ).normalize(),
    speed: 20, // Bullet speed
    distance: 0,
    maxDistance: 100, // Maximum travel distance
    isRemote: true, // Flag to identify remote bullets
  };

  // Add to scene and active bullets array
  scene.add(bullet);
  activeBullets.push(bulletData);

  return bulletData;
}

// Create a display for WebRTC connection status
function createWebRTCStatusDisplay() {
  const webrtcStatus = document.createElement("div");
  webrtcStatus.id = "webrtcStatus";
  webrtcStatus.style.position = "fixed";
  webrtcStatus.style.top = "70px";
  webrtcStatus.style.right = "10px";
  webrtcStatus.style.background = "rgba(0, 0, 0, 0.5)";
  webrtcStatus.style.color = "white";
  webrtcStatus.style.padding = "5px 10px";
  webrtcStatus.style.borderRadius = "5px";
  webrtcStatus.style.fontSize = "12px";
  webrtcStatus.style.fontFamily = "monospace";
  webrtcStatus.innerHTML = "WebRTC: Active";
  webrtcStatus.style.display = "none"; // Hide WebRTC status display
  document.getElementById("ui").appendChild(webrtcStatus);

  // Update the WebRTC status periodically
  setInterval(updateWebRTCStatus, 1000);
}

// Update the WebRTC connection status display
function updateWebRTCStatus() {
  const statusElement = document.getElementById("webrtcStatus");
  if (!statusElement) return;

  if (!rtcManager) {
    statusElement.innerHTML = "WebRTC: Not initialized";
    statusElement.style.color = "#ff6666";
    return;
  }

  // Just show that WebRTC is active without details about peers
  statusElement.innerHTML = "WebRTC: Active";
  statusElement.style.color = "#66ff66";
}

// Clean up WebRTC connections when the game ends
function cleanupWebRTC() {
  if (rtcManager) {
    console.log("Cleaning up WebRTC connections");
    rtcManager.destroyAll();
    rtcManager = null;
  }

  // Clear the peer latency data
  Object.keys(peerLatency).forEach((key) => delete peerLatency[key]);
  playerUpdatesViaWebRTC.clear();

  // Update the status display
  const statusElement = document.getElementById("webrtcStatus");
  if (statusElement) {
    statusElement.innerHTML = "WebRTC: Disconnected";
    statusElement.style.color = "#ff6666";
  }
}

// Toggle WebRTC debug information
function toggleWebRTCDebug() {
  const debugElement = document.getElementById("webrtcDebug");

  if (debugElement) {
    // If debug element exists, remove it
    debugElement.remove();
    return;
  }

  // Create debug element
  const debugDiv = document.createElement("div");
  debugDiv.id = "webrtcDebug";
  debugDiv.style.position = "fixed";
  debugDiv.style.bottom = "20px";
  debugDiv.style.right = "20px";
  debugDiv.style.background = "rgba(0, 0, 0, 0.7)";
  debugDiv.style.color = "#00ff00";
  debugDiv.style.padding = "10px";
  debugDiv.style.borderRadius = "5px";
  debugDiv.style.fontFamily = "monospace";
  debugDiv.style.fontSize = "12px";
  debugDiv.style.maxWidth = "300px";
  debugDiv.style.maxHeight = "200px";
  debugDiv.style.overflow = "auto";
  debugDiv.style.zIndex = "1000";
  document.getElementById("ui").appendChild(debugDiv);

  // Update debug info every second
  const debugInterval = setInterval(() => {
    if (!document.getElementById("webrtcDebug")) {
      clearInterval(debugInterval);
      return;
    }

    if (!rtcManager) {
      debugDiv.innerHTML = "WebRTC not initialized";
      return;
    }

    let debugInfo = "<strong>WebRTC Debug</strong><br>";
    debugInfo += `Connected Peers: ${rtcManager.getConnectedPeerCount()}<br>`;
    debugInfo += `Total Peers: ${rtcManager.peers.size}<br><br>`;

    // Connection state for each peer
    debugInfo += "<strong>Peer Connections:</strong><br>";
    if (rtcManager.peers.size === 0) {
      debugInfo += "No peers connected<br>";
    } else {
      rtcManager.peers.forEach((peer, peerId) => {
        const shortId = peerId.substring(0, 8);
        const state = rtcManager.connectionState[peerId] || "unknown";
        const latency = peerLatency[peerId]
          ? `${peerLatency[peerId]}ms`
          : "N/A";
        debugInfo += `${shortId}: ${state} (${latency})<br>`;
      });
    }

    debugDiv.innerHTML = debugInfo;
  }, 1000);
}

// Add key binding for WebRTC debug (Ctrl+D)
document.addEventListener("keydown", (event) => {
  if (event.ctrlKey && event.key === "d") {
    event.preventDefault();
    toggleWebRTCDebug();
  }
});

// Add window unload event to track player leave
window.addEventListener("beforeunload", () => {
  // Track player leave event
  if (analytics) {
    analytics.trackPlayerLeave();
  }
});

// Function to show the death modal
function showDeathModal(state) {
  // Play death sound
  if (deathSound) {
    deathSound.currentTime = 0;
    deathSound
      .play()
      .catch((e) => console.error("Error playing death sound:", e));
  }

  // Unlock pointer controls
  controls.unlock();

  // Get player stats
  const player = state.players[socket.id];
  if (player) {
    // Calculate player rank
    const alivePlayers = Object.values(state.players).filter(
      (p) => p.health > 0
    ).length;
    const rank = alivePlayers + 1; // Player just died, so rank is one more than alive players

    // Update death message and stats
    document.getElementById("deathMessage").textContent =
      "You were eliminated!";
    document.getElementById(
      "deathStats"
    ).textContent = `Kills: ${player.kills} | Deaths: ${player.deaths} | Rank: #${rank}`;
  }

  // Show the modal
  document.getElementById("respawnModal").style.display = "block";

  // Track death event in analytics
  if (analytics) {
    analytics.trackEvent("player_death", {
      kills: player ? player.kills : 0,
      rank: rank,
    });
  }
}

// Function to hide the death modal
function hideDeathModal() {
  document.getElementById("respawnModal").style.display = "none";
}

// Add event listeners for respawn modal buttons
document.addEventListener("DOMContentLoaded", function () {
  // Respawn button
  document
    .getElementById("respawnButton")
    .addEventListener("click", function () {
      // Request respawn from server
      if (socket && socket.connected) {
        socket.emit("requestRespawn");
        hideDeathModal();
        controls.lock(); // Lock controls again
      }
    });

  // Quit button
  document.getElementById("quitButton").addEventListener("click", function () {
    // Reload the page to go back to login screen
    window.location.reload();
  });
});
