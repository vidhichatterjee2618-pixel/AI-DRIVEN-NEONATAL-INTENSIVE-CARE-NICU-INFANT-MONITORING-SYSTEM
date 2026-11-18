/**
 * avatar.js
 * Manages the 3D Infant Avatar, including GLTF model loading, procedural fallback,
 * bone/part hierarchy, respiration expansion animation, and stress heatmap shading.
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { StressHeatmap } from './stressHeatmap.js';

export class InfantAvatar {
  constructor(sceneInstance) {
    this.nicuScene = sceneInstance;
    this.scene = sceneInstance.scene;

    // Root avatar group (holds model, bone references, heatmap mesh)
    this.rootGroup = new THREE.Group();
    this.rootGroup.name = 'InfantAvatarRoot';
    this.rootGroup.position.set(0, 0.05, 0); // resting on mattress surface
    this.scene.add(this.rootGroup);

    // Anatomical body parts dictionary for direct transformation
    this.parts = {};
    this.materials = [];
    this.chestNode = null;
    this.abdomenNode = null;
    this.armature = null;

    // Dedicated Stress Heatmap Module
    this.heatmap = new StressHeatmap({
      scoreMin: 0.0,
      scoreMax: 100.0
    });

    // Respiration Animation State (Section 10)
    this.respirationRate = 45;       // default breaths per minute
    this.respirationActive = true;
    this.respirationPhase = 0;       // sine wave phase
    this.targetChestExpansion = 1.0;
    this.currentChestExpansion = 1.0;
    this.maxExpansionScale = 0.055;  // 5.5% subtle clinical chest volume expansion

    // Heartbeat Visual Pulse State (Optional vitals.heart_rate)
    this.heartRate = null;           // beats per minute
    this.heartActive = false;
    this.heartPhase = 0;             // cardiac sine phase
    this.heartPulseScale = 1.0;

    // Tracking Stale Indicator
    this.isStale = false;
    this.stalePulseTime = 0;

    // Model load state
    this.isLoaded = false;

    // 1. Build immediate procedural avatar (guarantees instantaneous rendering)
    this._buildProceduralAvatar();

    // 2. Asynchronously attempt to load exported Blender GLB model (from public/models or models/)
    this._loadGLBModel('models/infant_avatar.glb');

    // Register with scene render loop
    this.nicuScene.addUpdateCallback((dt) => this.update(dt));
  }

  /**
   * Procedural Anatomically Plausible Newborn Infant Model
   * Used for instant rendering, bone accessibility, and guaranteed fallback.
   */
  _buildProceduralAvatar() {
    this.avatarMeshGroup = new THREE.Group();
    this.avatarMeshGroup.name = 'ProceduralInfantMeshGroup';

    // Standard medical PBR skin material
    const skinMat = new THREE.MeshStandardMaterial({
      color: this.heatmap.colorBaseline.clone(),
      roughness: 0.5,
      metalness: 0.05,
      flatShading: false
    });
    this.materials.push(skinMat);
    this.heatmap.registerMaterial(skinMat);
    this.skinMaterial = skinMat;

    // 1. Torso Root
    const torsoGroup = new THREE.Group();
    torsoGroup.name = 'TorsoGroup';

    // Chest (Expands with respiration)
    const chestGeo = new THREE.SphereGeometry(0.062, 32, 24);
    chestGeo.scale(1.0, 0.85, 0.80);
    this.chestMesh = new THREE.Mesh(chestGeo, skinMat);
    this.chestMesh.position.set(0, 0, -0.06);
    this.chestMesh.castShadow = true;
    this.chestMesh.receiveShadow = true;
    torsoGroup.add(this.chestMesh);
    this.chestNode = this.chestMesh;
    this.parts['chest'] = this.chestMesh;

    // Precordial Cardiac Pulse Node (Visual Heartbeat Indicator)
    const heartGeo = new THREE.CylinderGeometry(0.012, 0.014, 0.004, 24);
    this.heartMat = new THREE.MeshStandardMaterial({
      color: 0x0ea5e9,
      emissive: 0x334155,
      emissiveIntensity: 0.1,
      roughness: 0.3,
      metalness: 0.1,
      transparent: true,
      opacity: 0.25
    });
    this.heartMesh = new THREE.Mesh(heartGeo, this.heartMat);
    this.heartMesh.rotation.x = Math.PI / 2;
    this.heartMesh.position.set(0.022, 0.045, -0.06);
    torsoGroup.add(this.heartMesh);
    this.parts['heart_sensor'] = this.heartMesh;

    // Abdomen
    const abdGeo = new THREE.SphereGeometry(0.058, 28, 20);
    abdGeo.scale(0.95, 0.85, 0.82);
    this.abdomenMesh = new THREE.Mesh(abdGeo, skinMat);
    this.abdomenMesh.position.set(0, -0.005, 0.02);
    this.abdomenMesh.castShadow = true;
    torsoGroup.add(this.abdomenMesh);
    this.abdomenNode = this.abdomenMesh;
    this.parts['abdomen'] = this.abdomenMesh;

    // Pelvis / Hips
    const pelvisGeo = new THREE.SphereGeometry(0.052, 24, 18);
    pelvisGeo.scale(0.95, 0.80, 0.75);
    const pelvisMesh = new THREE.Mesh(pelvisGeo, skinMat);
    pelvisMesh.position.set(0, -0.005, 0.09);
    pelvisMesh.castShadow = true;
    torsoGroup.add(pelvisMesh);
    this.parts['pelvis'] = pelvisMesh;

    // 2. Neck & Head (Proportionate ~1:4 infant head-to-body ratio)
    const neckGeo = new THREE.CylinderGeometry(0.03, 0.034, 0.03, 18);
    const neckMesh = new THREE.Mesh(neckGeo, skinMat);
    neckMesh.position.set(0, 0.005, -0.12);
    neckMesh.rotation.x = Math.PI / 2;
    torsoGroup.add(neckMesh);
    this.parts['neck'] = neckMesh;

    const headGeo = new THREE.SphereGeometry(0.068, 32, 24);
    headGeo.scale(0.95, 1.05, 1.15); // Elongated neonatal cranium
    const headMesh = new THREE.Mesh(headGeo, skinMat);
    headMesh.position.set(0, 0.02, -0.185);
    headMesh.castShadow = true;
    torsoGroup.add(headMesh);
    this.parts['head'] = headMesh;

    // 3. Left Arm (Flexed physiological neonatal tone)
    const armLGroup = new THREE.Group();
    armLGroup.position.set(0.065, 0.005, -0.07);

    const upperArmL = this._createLimbSegment(0.02, 0.018, 0.06, skinMat);
    upperArmL.rotation.set(0.3, 0.2, 0.4);
    armLGroup.add(upperArmL);

    const forearmL = this._createLimbSegment(0.017, 0.015, 0.055, skinMat);
    forearmL.position.set(0.028, 0.012, 0.045);
    forearmL.rotation.set(0.6, -0.3, 0.2);
    armLGroup.add(forearmL);

    const handL = new THREE.Mesh(new THREE.SphereGeometry(0.016, 16, 12), skinMat);
    handL.position.set(0.028, 0.02, 0.08);
    armLGroup.add(handL);

    torsoGroup.add(armLGroup);
    this.parts['arm_left'] = armLGroup;

    // 4. Right Arm
    const armRGroup = new THREE.Group();
    armRGroup.position.set(-0.065, 0.005, -0.07);

    const upperArmR = this._createLimbSegment(0.02, 0.018, 0.06, skinMat);
    upperArmR.rotation.set(0.3, -0.2, -0.4);
    armRGroup.add(upperArmR);

    const forearmR = this._createLimbSegment(0.017, 0.015, 0.055, skinMat);
    forearmR.position.set(-0.028, 0.012, 0.045);
    forearmR.rotation.set(0.6, 0.3, -0.2);
    armRGroup.add(forearmR);

    const handR = new THREE.Mesh(new THREE.SphereGeometry(0.016, 16, 12), skinMat);
    handR.position.set(-0.028, 0.02, 0.08);
    armRGroup.add(handR);

    torsoGroup.add(armRGroup);
    this.parts['arm_right'] = armRGroup;

    // 5. Left Leg (Flexed, abducted newborn hip)
    const legLGroup = new THREE.Group();
    legLGroup.position.set(0.048, -0.005, 0.12);

    const thighL = this._createLimbSegment(0.025, 0.021, 0.07, skinMat);
    thighL.rotation.set(-0.4, 0.3, 0.3);
    legLGroup.add(thighL);

    const shinL = this._createLimbSegment(0.020, 0.017, 0.065, skinMat);
    shinL.position.set(0.018, 0.015, 0.06);
    shinL.rotation.set(0.4, -0.2, 0.1);
    legLGroup.add(shinL);

    const footL = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.016, 0.04), skinMat);
    footL.position.set(0.018, 0.015, 0.10);
    legLGroup.add(footL);

    torsoGroup.add(legLGroup);
    this.parts['leg_left'] = legLGroup;

    // 6. Right Leg
    const legRGroup = new THREE.Group();
    legRGroup.position.set(-0.048, -0.005, 0.12);

    const thighR = this._createLimbSegment(0.025, 0.021, 0.07, skinMat);
    thighR.rotation.set(-0.4, -0.3, -0.3);
    legRGroup.add(thighR);

    const shinR = this._createLimbSegment(0.020, 0.017, 0.065, skinMat);
    shinR.position.set(-0.018, 0.015, 0.06);
    shinR.rotation.set(0.4, 0.2, -0.1);
    legRGroup.add(shinR);

    const footR = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.016, 0.04), skinMat);
    footR.position.set(-0.018, 0.015, 0.10);
    legRGroup.add(footR);

    torsoGroup.add(legRGroup);
    this.parts['leg_right'] = legRGroup;

    // Medical ID Band on Right Ankle (Clinical detail)
    const bandGeo = new THREE.CylinderGeometry(0.021, 0.021, 0.014, 16);
    const bandMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    const bandMesh = new THREE.Mesh(bandGeo, bandMat);
    bandMesh.position.set(-0.018, 0.015, 0.08);
    bandMesh.rotation.x = Math.PI / 2;
    legRGroup.add(bandMesh);

    this.avatarMeshGroup.add(torsoGroup);
    this.rootGroup.add(this.avatarMeshGroup);
    this.isLoaded = true;
  }

  _createLimbSegment(radiusTop, radiusBottom, height, material) {
    const geo = new THREE.CylinderGeometry(radiusTop, radiusBottom, height, 16);
    geo.translate(0, 0, height * 0.5);
    const mesh = new THREE.Mesh(geo, material);
    mesh.castShadow = true;
    return mesh;
  }

  /**
   * Load Blender GLB model asynchronously with dual path fallback
   */
  _loadGLBModel(url) {
    const loader = new GLTFLoader();
    const tryLoad = (targetUrl, fallbackUrl) => {
      loader.load(
        targetUrl,
        (gltf) => {
          console.log('Successfully loaded Blender infant model:', targetUrl);
          const glbScene = gltf.scene;
          glbScene.traverse((child) => {
            if (child.isMesh) {
              child.castShadow = true;
              child.receiveShadow = true;
              if (child.material) {
                this.materials.push(child.material);
                this.heatmap.registerMaterial(child.material);
              }
            }
            if (child.isBone) {
              this.parts[child.name] = child;
            }
          });
          this.glbModel = glbScene;
        },
        undefined,
        (err) => {
          if (fallbackUrl) {
            tryLoad(fallbackUrl, null);
          } else {
            console.info('Using procedural neonatal infant avatar (clean instant 3D rendering).');
          }
        }
      );
    };

    tryLoad(url, 'public/' + url);
  }

  /**
   * Update avatar position & rotation from PoseMapper
   */
  setPose(transformData) {
    if (!transformData) return;

    const { position, rotation, isStale } = transformData;
    this.isStale = isStale || false;

    if (position) {
      this.rootGroup.position.set(position.x, position.y, position.z);
    }

    if (rotation) {
      this.rootGroup.rotation.set(rotation.x, rotation.y, rotation.z);
    }
  }

  /**
   * Update Respiration Rate (Section 10)
   * @param {number|null} rate Breaths per minute (e.g. 45)
   */
  setRespirationRate(rate) {
    if (rate === null || rate === undefined || isNaN(rate)) {
      this.respirationActive = false;
      this.targetChestExpansion = 1.0;
    } else {
      this.respirationActive = true;
      this.respirationRate = Math.max(0, Number(rate));
    }
  }

  /**
   * Update Heart Rate (Optional vitals.heart_rate)
   * @param {number|null} rate Heartbeats per minute
   */
  setHeartRate(rate) {
    if (rate === null || rate === undefined || isNaN(rate) || Number(rate) <= 0) {
      this.heartActive = false;
      this.heartRate = null;
      if (this.heartMat) {
        this.heartMat.opacity = 0.25;
        this.heartMat.emissiveIntensity = 0.05;
        this.heartMat.emissive.setHex(0x334155);
      }
      if (this.heartMesh) {
        this.heartMesh.scale.set(1.0, 1.0, 1.0);
      }
    } else {
      this.heartActive = true;
      this.heartRate = Number(rate);
      if (this.heartMat) {
        this.heartMat.emissive.setHex(0xf43f5e); // gentle rose cardiac pulse
      }
    }
  }

  /**
   * Update Stress Score & Heatmap (Section 11)
   * @param {number|null} score Stress metric (e.g. 25.5)
   */
  setStressScore(score) {
    return this.heatmap.setStressScore(score);
  }

  /**
   * Configure Stress range limits without medical threshold claims
   */
  setStressRange(min, max) {
    this.heatmap.configureRange(min, max);
  }

  /**
   * Per-frame animation tick
   * @param {number} dt Delta time in seconds
   */
  update(dt) {
    // 1. Respiration chest expansion sine wave (Section 10)
    if (this.respirationActive && this.respirationRate > 0) {
      // Frequency: breaths per minute to radians per second
      // (rate / 60) * 2 * PI
      const freq = (this.respirationRate / 60.0) * Math.PI * 2;
      this.respirationPhase += freq * dt;

      // Expansion factor: 1.0 to (1.0 + maxExpansionScale)
      const expansion = Math.sin(this.respirationPhase);
      this.targetChestExpansion = 1.0 + (expansion > 0 ? expansion * this.maxExpansionScale : expansion * 0.012);
    } else {
      // When paused or unavailable, return smoothly to resting baseline volume (1.0)
      this.targetChestExpansion = 1.0;
    }

    // Smooth lerp for chest expansion to prevent visual glitching
    this.currentChestExpansion += (this.targetChestExpansion - this.currentChestExpansion) * Math.min(1.0, dt * 8.0);

    if (this.chestNode) {
      this.chestNode.scale.set(
        1.0 * this.currentChestExpansion,
        0.85 * this.currentChestExpansion,
        0.80 * this.currentChestExpansion
      );
    }
    if (this.abdomenNode) {
      // Abdomen moves subtly in anatomical sync with the diaphragm
      const abdScale = 1.0 + (this.currentChestExpansion - 1.0) * 0.65;
      this.abdomenNode.scale.set(0.95 * abdScale, 0.85 * abdScale, 0.82);
    }

    // 2. Cardiac Pulse Animation (Independent of respiration, synced to heart_rate / 60 Hz)
    if (this.heartActive && this.heartRate > 0) {
      const cardiacFreq = (this.heartRate / 60.0) * Math.PI * 2;
      this.heartPhase += cardiacFreq * dt;

      // Realistic sharp systolic peak pulse
      const rawSine = Math.sin(this.heartPhase);
      const beatPulse = Math.pow(Math.max(0, rawSine), 4.0);

      if (this.heartMesh) {
        const scale = 1.0 + beatPulse * 0.35;
        this.heartMesh.scale.set(scale, scale, 1.0 + beatPulse * 0.2);
      }
      if (this.heartMat) {
        this.heartMat.opacity = 0.35 + beatPulse * 0.60;
        this.heartMat.emissiveIntensity = 0.15 + beatPulse * 1.4;
      }
    } else {
      if (this.heartMesh && this.heartMesh.scale.x !== 1.0) {
        this.heartMesh.scale.set(1.0, 1.0, 1.0);
      }
    }

    // 3. Delegate Heatmap Per-Frame Color Modulation to StressHeatmap
    this.heatmap.update(dt);

    // 4. Stale Pose Indication (Section 6: Visibly marks pose as stale)
    if (this.isStale) {
      this.stalePulseTime += dt * 3.5;
      const opacityFactor = 0.60 + 0.40 * Math.sin(this.stalePulseTime);
      for (const mat of this.materials) {
        if (mat) {
          mat.transparent = true;
          mat.opacity = opacityFactor;
        }
      }
    } else {
      for (const mat of this.materials) {
        if (mat && mat.transparent) {
          mat.opacity = 1.0;
        }
      }
    }
  }

  /**
   * Reset Avatar state to defaults
   */
  reset() {
    this.rootGroup.position.set(0, 0.05, 0);
    this.rootGroup.rotation.set(0, 0, 0);
    this.setRespirationRate(45);
    this.setHeartRate(null);
    this.heatmap.reset();
    this.isStale = false;
  }
}
