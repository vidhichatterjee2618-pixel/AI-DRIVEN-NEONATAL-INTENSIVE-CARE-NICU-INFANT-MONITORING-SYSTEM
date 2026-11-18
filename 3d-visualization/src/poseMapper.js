/**
 * poseMapper.js
 * Converts normalized 2D monitoring coordinates [x, y] to 3D avatar transformations.
 * Handles orientation updates and smooth interpolation.
 *
 * Image Coordinate Convention:
 * - x: [0.0, 1.0], 0 = Left edge of camera frame, 1 = Right edge
 * - y: [0.0, 1.0], 0 = Top of camera frame, 1 = Bottom of camera frame (downward Y)
 *
 * 3D Bed Coordinate Convention (Incubator mattress):
 * - X: Left (-) / Right (+) across mattress width (approx 0.35m)
 * - Y: Height above mattress (0 = mattress plane, infant center ~ 0.05m)
 * - Z: Head-to-Foot axis along mattress length (approx 0.60m)
 *      -Z = towards head of incubator, +Z = towards foot of incubator
 */

export class PoseMapper {
  constructor(config = {}) {
    // Bed boundaries in 3D world meters
    this.bedWidth = config.bedWidth || 0.40;   // X span (-0.20 to +0.20)
    this.bedLength = config.bedLength || 0.60; // Z span (-0.30 to +0.30)
    this.bedBaseY = config.bedBaseY || 0.05;   // Resting elevation above mattress

    // Target transforms for smooth animation
    this.currentPosition = { x: 0, y: this.bedBaseY, z: 0 };
    this.targetPosition = { x: 0, y: this.bedBaseY, z: 0 };

    this.currentRotation = { x: 0, y: 0, z: 0 }; // Euler angles in radians
    this.targetRotation = { x: 0, y: 0, z: 0 };

    // Orientation state
    this.currentOrientation = 'supine';
    this.isTrackingValid = false;
    this.isStale = false;

    // Smoothing factor (lerp rate)
    this.lerpSpeed = config.lerpSpeed || 4.5;
  }

  /**
   * Map parsed pose object into 3D avatar target transforms.
   * @param {Object} parsedPose Validated pose object from jsonParser.js
   * @returns {Object} Mapping diagnosis & computed targets
   */
  mapPose(parsedPose) {
    if (!parsedPose) {
      this.isStale = true;
      return { status: 'NO_POSE_DATA', targetPos: this.targetPosition, targetRot: this.targetRotation };
    }

    const { shoulder_position, hip_position, orientation, shoulderAvailable, hipAvailable, isStale } = parsedPose;
    this.isStale = isStale || false;

    // 1. Calculate Target 3D Position
    // Image coordinate mapping:
    // 3D X = (normX - 0.5) * bedWidth
    // 3D Z = (normY - 0.5) * bedLength (Image Y increases downwards; head is at lower normY, feet at higher normY)
    let computedCenterX = 0;
    let computedCenterZ = 0;
    let computedYaw = 0; // In-plane rotation (heading)

    if (shoulderAvailable && hipAvailable) {
      // Both landmarks available: determine exact center midpoint and trunk angle
      const sh3DX = (shoulder_position[0] - 0.5) * this.bedWidth;
      const sh3DZ = (shoulder_position[1] - 0.5) * this.bedLength;

      const hip3DX = (hip_position[0] - 0.5) * this.bedWidth;
      const hip3DZ = (hip_position[1] - 0.5) * this.bedLength;

      // Center of trunk midpoint
      computedCenterX = (sh3DX + hip3DX) * 0.5;
      computedCenterZ = (sh3DZ + hip3DZ) * 0.5;

      // In-plane trunk heading (Yaw angle around vertical Y axis)
      // Vector from hip to shoulder points toward head:
      const dx = sh3DX - hip3DX;
      const dz = sh3DZ - hip3DZ;
      // Normal alignment is dx ~ 0, dz < 0 (head towards -Z)
      computedYaw = Math.atan2(dx, -dz);
      this.isTrackingValid = true;
    } else if (shoulderAvailable) {
      // Only shoulders available: offset by estimated torso half-length (approx 0.08m)
      const sh3DX = (shoulder_position[0] - 0.5) * this.bedWidth;
      const sh3DZ = (shoulder_position[1] - 0.5) * this.bedLength;
      computedCenterX = sh3DX;
      computedCenterZ = sh3DZ + 0.08; // hip would be lower down (+Z)
      this.isTrackingValid = true;
    } else if (hipAvailable) {
      // Only hips available: offset by estimated torso half-length
      const hip3DX = (hip_position[0] - 0.5) * this.bedWidth;
      const hip3DZ = (hip_position[1] - 0.5) * this.bedLength;
      computedCenterX = hip3DX;
      computedCenterZ = hip3DZ - 0.08; // shoulders would be higher up (-Z)
      this.isTrackingValid = true;
    } else {
      // Neither landmark available: preserve last position without fabricating
      this.isTrackingValid = false;
      computedCenterX = this.targetPosition.x;
      computedCenterZ = this.targetPosition.z;
    }

    this.targetPosition.x = computedCenterX;
    this.targetPosition.y = this.bedBaseY;
    this.targetPosition.z = computedCenterZ;

    // 2. Map Body Orientation to Euler Angles (Roll around longitudinal spine axis)
    // Supine: Roll = 0 (lying on back, chest facing +Y upward)
    // Prone: Roll = Math.PI (lying on abdomen, back facing +Y upward)
    // Left Lateral: Roll = Math.PI / 2 (rolled 90 deg onto left side)
    // Right Lateral: Roll = -Math.PI / 2 (rolled 90 deg onto right side)
    // Unknown: Maintain previous roll or neutral 0
    let rollAngle = 0;
    const normOrient = (orientation || 'unknown').toLowerCase();
    this.currentOrientation = normOrient;

    switch (normOrient) {
      case 'supine':
        rollAngle = 0;
        break;
      case 'prone':
        rollAngle = Math.PI;
        break;
      case 'left lateral':
        rollAngle = Math.PI * 0.5;
        break;
      case 'right lateral':
        rollAngle = -Math.PI * 0.5;
        break;
      case 'unknown':
      default:
        // Do not jump; maintain current roll
        rollAngle = this.currentRotation.z;
        break;
    }

    // Apply target rotations:
    // Z rotation = Roll (axial body orientation)
    // Y rotation = Yaw (in-plane tilt)
    // X rotation = Pitch (slight head elevation if needed, default 0)
    this.targetRotation.x = 0;
    this.targetRotation.y = computedYaw;
    this.targetRotation.z = rollAngle;

    return {
      status: 'OK',
      targetPosition: { ...this.targetPosition },
      targetRotation: { ...this.targetRotation },
      orientation: this.currentOrientation,
      isTrackingValid: this.isTrackingValid,
      isStale: this.isStale
    };
  }

  /**
   * Per-frame update loop for smooth interpolation (spring/lerp).
   * @param {number} deltaTime Time elapsed in seconds
   * @returns {Object} Interpolated current position and rotation
   */
  update(deltaTime = 0.016) {
    const alpha = Math.min(1.0, deltaTime * this.lerpSpeed);

    // Linear interpolation for position
    this.currentPosition.x += (this.targetPosition.x - this.currentPosition.x) * alpha;
    this.currentPosition.y += (this.targetPosition.y - this.currentPosition.y) * alpha;
    this.currentPosition.z += (this.targetPosition.z - this.currentPosition.z) * alpha;

    // Spherical / shortest-angle interpolation for rotation
    this.currentRotation.x += this._shortestAngleDiff(this.currentRotation.x, this.targetRotation.x) * alpha;
    this.currentRotation.y += this._shortestAngleDiff(this.currentRotation.y, this.targetRotation.y) * alpha;
    this.currentRotation.z += this._shortestAngleDiff(this.currentRotation.z, this.targetRotation.z) * alpha;

    return {
      position: { ...this.currentPosition },
      rotation: { ...this.currentRotation },
      orientation: this.currentOrientation,
      isStale: this.isStale
    };
  }

  /**
   * Helper for shortest path angular interpolation to avoid 360-degree flip spins
   */
  _shortestAngleDiff(from, to) {
    let diff = (to - from) % (Math.PI * 2);
    if (diff > Math.PI) diff -= Math.PI * 2;
    if (diff < -Math.PI) diff += Math.PI * 2;
    return diff;
  }

  /**
   * Reset mapper to central supine position
   */
  reset() {
    this.currentPosition = { x: 0, y: this.bedBaseY, z: 0 };
    this.targetPosition = { x: 0, y: this.bedBaseY, z: 0 };
    this.currentRotation = { x: 0, y: 0, z: 0 };
    this.targetRotation = { x: 0, y: 0, z: 0 };
    this.currentOrientation = 'supine';
    this.isTrackingValid = true;
    this.isStale = false;
  }
}
