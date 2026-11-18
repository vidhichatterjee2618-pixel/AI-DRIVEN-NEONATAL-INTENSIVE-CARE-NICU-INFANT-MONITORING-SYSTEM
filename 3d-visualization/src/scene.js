/**
 * scene.js
 * Three.js 3D scene setup, medical incubator environment, lighting,
 * responsive camera controls, and render loop.
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export class NICUScene {
  constructor(containerElement) {
    this.container = containerElement;
    this.width = containerElement.clientWidth || 800;
    this.height = containerElement.clientHeight || 600;

    // 1. Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0e1726); // Dark medical tech blue/slate

    // 2. Camera
    this.camera = new THREE.PerspectiveCamera(45, this.width / this.height, 0.05, 50);
    this.defaultCameraPos = new THREE.Vector3(0, 0.75, 0.85);
    this.defaultCameraTarget = new THREE.Vector3(0, 0.05, 0);
    this.camera.position.copy(this.defaultCameraPos);

    // 3. Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setSize(this.width, this.height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.container.appendChild(this.renderer.domElement);

    // 4. Controls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.target.copy(this.defaultCameraTarget);
    this.controls.maxPolarAngle = Math.PI * 0.48; // Prevent going beneath floor
    this.controls.minDistance = 0.2;
    this.controls.maxDistance = 3.0;

    // 5. Lighting Setup
    this._setupLighting();

    // 6. Medical Incubator Environment
    this._createIncubatorEnvironment();

    // 7. Resize Observer
    this.resizeObserver = new ResizeObserver(() => this.onWindowResize());
    this.resizeObserver.observe(this.container);
    window.addEventListener('resize', () => this.onWindowResize());

    // Clock for delta time
    this.clock = new THREE.Clock();
    this.animationCallbacks = [];

    // Start render loop
    this._animate = this._animate.bind(this);
    requestAnimationFrame(this._animate);
  }

  _setupLighting() {
    // Soft Ambient fill
    const ambientLight = new THREE.AmbientLight(0xd9e6f2, 0.85);
    this.scene.add(ambientLight);

    // Main Overhead Surgical/Exam Spotlight (Key Light)
    const keyLight = new THREE.DirectionalLight(0xffffff, 1.5);
    keyLight.position.set(0.6, 1.8, 0.6);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    keyLight.shadow.camera.near = 0.1;
    keyLight.shadow.camera.far = 4.0;
    keyLight.shadow.camera.left = -0.5;
    keyLight.shadow.camera.right = 0.5;
    keyLight.shadow.camera.top = 0.5;
    keyLight.shadow.camera.bottom = -0.5;
    keyLight.shadow.bias = -0.001;
    this.scene.add(keyLight);

    // Subtle Cyan/Teal Medical Rim Light
    const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.6);
    rimLight.position.set(-0.8, 0.6, -0.6);
    this.scene.add(rimLight);

    // Soft Floor Bounce Light
    const bounceLight = new THREE.DirectionalLight(0x1e293b, 0.4);
    bounceLight.position.set(0, -1, 0);
    this.scene.add(bounceLight);
  }

  _createIncubatorEnvironment() {
    const incubatorGroup = new THREE.Group();
    incubatorGroup.name = 'IncubatorEnvironment';

    // 1. Incubator Base / Cart
    const baseGeo = new THREE.BoxGeometry(0.55, 0.08, 0.85);
    const baseMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.3,
      metalness: 0.6
    });
    const baseMesh = new THREE.Mesh(baseGeo, baseMat);
    baseMesh.position.set(0, -0.04, 0);
    baseMesh.receiveShadow = true;
    incubatorGroup.add(baseMesh);

    // 2. Clinical Mattress
    const mattressGeo = new THREE.BoxGeometry(0.38, 0.04, 0.68);
    const mattressMat = new THREE.MeshStandardMaterial({
      color: 0xf1f5f9, // Clean clinical hospital white/pale ivory
      roughness: 0.8,
      metalness: 0.05
    });
    this.mattressMesh = new THREE.Mesh(mattressGeo, mattressMat);
    this.mattressMesh.position.set(0, 0.02, 0);
    this.mattressMesh.receiveShadow = true;
    incubatorGroup.add(this.mattressMesh);

    // 3. Bed Center Alignment Markers & Grid
    const grid = new THREE.GridHelper(0.7, 14, 0x0284c7, 0x334155);
    grid.position.set(0, 0.041, 0);
    incubatorGroup.add(grid);

    // 4. Transparent Acrylic Canopy (Hood)
    // Modeled as a transparent protective dome
    const canopyGeo = new THREE.BoxGeometry(0.48, 0.32, 0.78);
    const canopyMat = new THREE.MeshPhysicalMaterial({
      color: 0x93c5fd,
      transparent: true,
      opacity: 0.18,
      roughness: 0.1,
      metalness: 0.0,
      transmission: 0.6,
      ior: 1.49,
      depthWrite: false
    });
    const canopyMesh = new THREE.Mesh(canopyGeo, canopyMat);
    canopyMesh.position.set(0, 0.20, 0);
    incubatorGroup.add(canopyMesh);

    // 5. Status LED Ring in Incubator Base
    const ledGeo = new THREE.RingGeometry(0.04, 0.05, 32);
    this.statusLedMat = new THREE.MeshBasicMaterial({ color: 0x22c55e, side: THREE.DoubleSide });
    const ledMesh = new THREE.Mesh(ledGeo, this.statusLedMat);
    ledMesh.rotation.x = Math.PI / 2;
    ledMesh.position.set(0.18, 0.042, -0.30);
    incubatorGroup.add(ledMesh);

    this.scene.add(incubatorGroup);
  }

  /**
   * Register a per-frame animation callback
   */
  addUpdateCallback(fn) {
    this.animationCallbacks.push(fn);
  }

  /**
   * Main render loop
   */
  _animate() {
    requestAnimationFrame(this._animate);

    const deltaTime = this.clock.getDelta();

    // Execute registered updates (avatar respiration, pose interpolation, etc.)
    for (const cb of this.animationCallbacks) {
      cb(deltaTime);
    }

    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  /**
   * Window / Container resize handler
   */
  onWindowResize() {
    this.width = this.container.clientWidth;
    this.height = this.container.clientHeight;
    if (this.width === 0 || this.height === 0) return;

    this.camera.aspect = this.width / this.height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(this.width, this.height);
  }

  /**
   * Set Camera view presets
   */
  setCameraPreset(preset) {
    const duration = 800; // ms transition
    const startPos = this.camera.position.clone();
    let targetPos = this.defaultCameraPos.clone();

    switch (preset) {
      case 'top':
        // Direct top-down observation (matches camera coordinate space)
        targetPos.set(0, 1.1, 0.001);
        break;
      case 'lateral':
        // Side clinical perspective
        targetPos.set(0.95, 0.25, 0);
        break;
      case 'front':
        // Head-on view
        targetPos.set(0, 0.40, 0.90);
        break;
      case 'reset':
      default:
        targetPos.copy(this.defaultCameraPos);
        break;
    }

    const startTime = performance.now();
    const animateCamera = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(1.0, elapsed / duration);
      // Smooth ease-out cubic
      const ease = 1 - Math.pow(1 - progress, 3);
      this.camera.position.lerpVectors(startPos, targetPos, ease);
      this.controls.target.copy(this.defaultCameraTarget);
      if (progress < 1.0) {
        requestAnimationFrame(animateCamera);
      }
    };
    requestAnimationFrame(animateCamera);
  }

  /**
   * Update incubator status LED color
   */
  setConnectionStatusColor(hexColor) {
    if (this.statusLedMat) {
      this.statusLedMat.color.setHex(hexColor);
    }
  }

  dispose() {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
    this.renderer.dispose();
  }
}
