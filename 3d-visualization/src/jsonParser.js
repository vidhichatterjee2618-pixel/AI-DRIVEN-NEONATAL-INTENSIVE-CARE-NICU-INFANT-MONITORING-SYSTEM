/**
 * jsonParser.js
 * Dedicated JSON parser and schema validator for NICU 3D Visualization.
 * Adheres strictly to the agreed common JSON contract.
 *
 * Contract Schema:
 * {
 *   "pose": {
 *     "shoulder_position": [0.45, 0.32], // [x, y] in [0, 1] or null
 *     "hip_position": [0.48, 0.72],      // [x, y] in [0, 1] or null
 *     "orientation": "supine"            // supine | prone | left lateral | right lateral | unknown
 *   },
 *   "vitals": {
 *     "respiration_rate": 45,            // number >= 0 or null
 *     "stress_score": 25.5,              // number or null
 *     "posture": "normal",               // string or null
 *     "movement_status": "normal"        // string or null
 *   }
 * }
 */

export class JSONParser {
  constructor() {
    this.lastValidPose = null;
    this.lastValidTimestamp = null;
  }

  /**
   * Parse and validate incoming data (string or object).
   * @param {string | object} input
   * @returns {Object} Validation result with clean data, errors, and warnings
   */
  parse(input) {
    const errors = [];
    const warnings = [];
    let rawObj = null;

    // 1. Safe JSON decoding
    if (typeof input === 'string') {
      try {
        rawObj = JSON.parse(input);
      } catch (err) {
        errors.push(`JSON Syntax Error: Invalid JSON format (${err.message})`);
        return {
          success: false,
          data: null,
          errors,
          warnings,
          raw: input
        };
      }
    } else if (typeof input === 'object' && input !== null) {
      rawObj = input;
    } else {
      errors.push(`Type Error: Expected JSON string or object, received ${typeof input}`);
      return {
        success: false,
        data: null,
        errors,
        warnings,
        raw: input
      };
    }

    // 2. Validate Root Structure
    if (typeof rawObj !== 'object' || Array.isArray(rawObj) || rawObj === null) {
      errors.push('Root structure must be a non-null object');
      return { success: false, data: null, errors, warnings };
    }

    // 3. Parse Pose Section
    const parsedPose = this._validatePose(rawObj.pose, errors, warnings);

    // 4. Parse Vitals Section
    const parsedVitals = this._validateVitals(rawObj.vitals, errors, warnings);

    // Optional metadata: timestamp or sequence number
    let timestamp = null;
    if (rawObj.timestamp) {
      const parsedTime = new Date(rawObj.timestamp);
      if (!isNaN(parsedTime.getTime())) {
        timestamp = parsedTime.toISOString();
      } else if (typeof rawObj.timestamp === 'number') {
        timestamp = new Date(rawObj.timestamp).toISOString();
      }
    }

    const hasCriticalErrors = errors.length > 0;

    const validatedResult = {
      success: !hasCriticalErrors,
      data: {
        pose: parsedPose,
        vitals: parsedVitals,
        timestamp: timestamp || new Date().toISOString()
      },
      errors,
      warnings
    };

    // 5. Update last valid pose cache if pose coordinates were valid
    if (validatedResult.success && parsedPose) {
      if (parsedPose.shoulder_position !== null || parsedPose.hip_position !== null) {
        this.lastValidPose = {
          shoulder_position: parsedPose.shoulder_position ? [...parsedPose.shoulder_position] : (this.lastValidPose ? this.lastValidPose.shoulder_position : null),
          hip_position: parsedPose.hip_position ? [...parsedPose.hip_position] : (this.lastValidPose ? this.lastValidPose.hip_position : null),
          orientation: parsedPose.orientation || (this.lastValidPose ? this.lastValidPose.orientation : 'supine')
        };
        this.lastValidTimestamp = validatedResult.data.timestamp;
      }
    }

    return validatedResult;
  }

  /**
   * Validate pose coordinates and orientation.
   * Preserves previous valid coordinates when current are missing,
   * but explicitly tags isStale=true.
   */
  _validatePose(poseObj, errors, warnings) {
    if (!poseObj || typeof poseObj !== 'object') {
      warnings.push("Missing or invalid 'pose' section in input payload");
      return {
        shoulder_position: null,
        hip_position: null,
        orientation: 'unknown',
        isStale: true,
        shoulderAvailable: false,
        hipAvailable: false,
        cachedPose: this.lastValidPose
      };
    }

    // Shoulder coordinate validation
    const shoulderCheck = this._validateCoordinate2D(poseObj.shoulder_position, 'shoulder_position', warnings);
    // Hip coordinate validation
    const hipCheck = this._validateCoordinate2D(poseObj.hip_position, 'hip_position', warnings);

    // Orientation validation
    const validOrientations = ['supine', 'prone', 'left lateral', 'right lateral', 'unknown'];
    let orientation = 'unknown';

    if (typeof poseObj.orientation === 'string') {
      const normalizedOrient = poseObj.orientation.trim().toLowerCase();
      if (validOrientations.includes(normalizedOrient)) {
        orientation = normalizedOrient;
      } else {
        warnings.push(`Unrecognized orientation '${poseObj.orientation}'. Defaulting to 'unknown'.`);
        orientation = 'unknown';
      }
    } else if (poseObj.orientation !== undefined && poseObj.orientation !== null) {
      warnings.push(`Field 'orientation' must be a string. Received ${typeof poseObj.orientation}`);
    } else {
      warnings.push("Field 'orientation' missing from pose. Tagged as 'unknown'.");
    }

    const isStale = (!shoulderCheck.isValid && this.lastValidPose !== null) || (!hipCheck.isValid && this.lastValidPose !== null);

    return {
      shoulder_position: shoulderCheck.isValid ? shoulderCheck.coords : (this.lastValidPose ? this.lastValidPose.shoulder_position : null),
      hip_position: hipCheck.isValid ? hipCheck.coords : (this.lastValidPose ? this.lastValidPose.hip_position : null),
      orientation: orientation,
      shoulderAvailable: shoulderCheck.isValid,
      hipAvailable: hipCheck.isValid,
      isStale: isStale,
      cachedPose: this.lastValidPose
    };
  }

  /**
   * Validate normalized 2D coordinate array [x, y].
   * Strictly enforces 0.0 <= coord <= 1.0.
   */
  _validateCoordinate2D(coord, fieldName, warnings) {
    if (coord === null || coord === undefined) {
      warnings.push(`Field '${fieldName}' is null or missing`);
      return { isValid: false, coords: null };
    }

    if (!Array.isArray(coord)) {
      warnings.push(`Field '${fieldName}' must be an array of 2 numbers. Received ${typeof coord}`);
      return { isValid: false, coords: null };
    }

    if (coord.length !== 2) {
      warnings.push(`Field '${fieldName}' must contain exactly 2 numbers [x, y]. Found length: ${coord.length}`);
      return { isValid: false, coords: null };
    }

    const [x, y] = coord;
    if (typeof x !== 'number' || isNaN(x) || typeof y !== 'number' || isNaN(y)) {
      warnings.push(`Field '${fieldName}' contains non-numeric values: [${x}, ${y}]`);
      return { isValid: false, coords: null };
    }

    if (x < 0.0 || x > 1.0 || y < 0.0 || y > 1.0) {
      warnings.push(`Field '${fieldName}' coordinates [${x}, ${y}] exceed normalized range [0.0, 1.0]`);
      return { isValid: false, coords: null };
    }

    return {
      isValid: true,
      coords: [Number(x.toFixed(4)), Number(y.toFixed(4))]
    };
  }

  /**
   * Validate vital readings without fabricating missing data.
   * Distinguishes 0 vs null/unavailable.
   */
  _validateVitals(vitalsObj, errors, warnings) {
    if (!vitalsObj || typeof vitalsObj !== 'object') {
      warnings.push("Missing or invalid 'vitals' section");
      return {
        respiration_rate: null,
        respiration_available: false,
        heart_rate: null,
        heart_rate_available: false,
        stress_score: null,
        stress_available: false,
        posture: 'Unavailable',
        movement_status: 'Unavailable'
      };
    }

    // 1. Respiration Rate
    let respiration_rate = null;
    let respiration_available = false;

    if (vitalsObj.respiration_rate !== null && vitalsObj.respiration_rate !== undefined) {
      const rr = Number(vitalsObj.respiration_rate);
      if (isNaN(rr) || rr < 0) {
        warnings.push(`Invalid respiration_rate '${vitalsObj.respiration_rate}'. Must be number >= 0`);
      } else {
        respiration_rate = rr;
        respiration_available = true;
      }
    } else {
      warnings.push("Field 'respiration_rate' is null or missing");
    }

    // 2. Optional Heart Rate (BPM) - Backward-compatible optional field
    let heart_rate = null;
    let heart_rate_available = false;

    if (vitalsObj.heart_rate !== null && vitalsObj.heart_rate !== undefined) {
      const hr = Number(vitalsObj.heart_rate);
      if (isNaN(hr) || hr < 0) {
        warnings.push(`Invalid heart_rate '${vitalsObj.heart_rate}'. Must be number >= 0`);
      } else {
        heart_rate = hr;
        heart_rate_available = true;
      }
    }

    // 3. Stress Score
    let stress_score = null;
    let stress_available = false;

    if (vitalsObj.stress_score !== null && vitalsObj.stress_score !== undefined) {
      const ss = Number(vitalsObj.stress_score);
      if (isNaN(ss)) {
        warnings.push(`Invalid stress_score '${vitalsObj.stress_score}'. Must be a number`);
      } else {
        stress_score = ss;
        stress_available = true;
      }
    } else {
      warnings.push("Field 'stress_score' is null or missing");
    }

    // 4. Posture
    let posture = 'Unavailable';
    if (typeof vitalsObj.posture === 'string' && vitalsObj.posture.trim().length > 0) {
      posture = vitalsObj.posture.trim();
    } else {
      warnings.push("Field 'posture' is null or missing");
    }

    // 5. Movement Status
    let movement_status = 'Unavailable';
    if (typeof vitalsObj.movement_status === 'string' && vitalsObj.movement_status.trim().length > 0) {
      movement_status = vitalsObj.movement_status.trim();
    } else {
      warnings.push("Field 'movement_status' is null or missing");
    }

    return {
      respiration_rate,
      respiration_available,
      heart_rate,
      heart_rate_available,
      stress_score,
      stress_available,
      posture,
      movement_status
    };
  }

  /**
   * Reset internal cache
   */
  resetCache() {
    this.lastValidPose = null;
    this.lastValidTimestamp = null;
  }
}
