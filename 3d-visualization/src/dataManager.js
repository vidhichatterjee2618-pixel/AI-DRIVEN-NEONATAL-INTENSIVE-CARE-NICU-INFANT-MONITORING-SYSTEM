/**
 * dataManager.js
 * Central coordinator for incoming JSON streams, validation, dispatching to 3D avatar,
 * pose mapper, UI indicators, and mock live simulation.
 */

import { JSONParser } from './jsonParser.js';

export class DataManager {
  constructor({ poseMapper, avatar, indicators }) {
    this.poseMapper = poseMapper;
    this.avatar = avatar;
    this.indicators = indicators;
    this.parser = new JSONParser();

    // Sequence / Timestamp tracking to prevent out-of-order updates
    this.lastProcessedTimestamp = 0;

    // Simulation state
    this.isSimulating = false;
    this.simulationTimer = null;
    this.simulationStep = 0;

    // Callbacks
    this.onDataProcessed = null;
  }

  /**
   * Primary entry point for incoming JSON telemetry (from mock, file, API, or Firebase)
   * @param {string|object} rawInput
   * @returns {Object} Processing result
   */
  processIncomingData(rawInput) {
    const parseResult = this.parser.parse(rawInput);

    // If critical parse errors exist, notify indicators & developer console
    if (!parseResult.success) {
      console.warn('DataManager: Telemetry rejected due to critical errors:', parseResult.errors);
      this.indicators.update(parseResult);
      if (this.onDataProcessed) this.onDataProcessed(parseResult);
      return parseResult;
    }

    const { data } = parseResult;

    // Out-of-order packet protection
    if (data.timestamp) {
      const incomingTime = new Date(data.timestamp).getTime();
      if (!isNaN(incomingTime) && incomingTime < this.lastProcessedTimestamp) {
        parseResult.warnings.push(`Discarded out-of-order packet: ${data.timestamp} < last processed ${new Date(this.lastProcessedTimestamp).toISOString()}`);
        console.warn('DataManager:', parseResult.warnings[parseResult.warnings.length - 1]);
        this.indicators.update(parseResult);
        return parseResult;
      }
      this.lastProcessedTimestamp = incomingTime;
    }

    // 1. Dispatch Pose to PoseMapper
    if (data.pose) {
      this.poseMapper.mapPose(data.pose);
    }

    // 2. Dispatch Vitals to Avatar (respiration, heart rate, and stress)
    if (data.vitals) {
      this.avatar.setRespirationRate(data.vitals.respiration_rate);
      this.avatar.setHeartRate(data.vitals.heart_rate);
      this.avatar.setStressScore(data.vitals.stress_score);
    }

    // 3. Update Dashboard Indicators
    this.indicators.update(parseResult);

    if (this.onDataProcessed) {
      this.onDataProcessed(parseResult);
    }

    return parseResult;
  }

  /**
   * Start synthetic live monitoring simulation
   * Clearly identified as synthetic non-clinical demonstration data.
   */
  startSimulation(intervalMs = 1200) {
    if (this.isSimulating) return;

    this.isSimulating = true;
    console.log('DataManager: Starting synthetic live telemetry simulation (interval: ' + intervalMs + 'ms)');

    const orientations = ['supine', 'supine', 'right lateral', 'supine', 'left lateral', 'prone', 'supine'];

    this.simulationTimer = setInterval(() => {
      this.simulationStep++;

      // Generate synthetic physiological oscillation
      const t = this.simulationStep * 0.2;
      const baseShoulderX = 0.45 + 0.04 * Math.sin(t);
      const baseShoulderY = 0.32 + 0.02 * Math.cos(t * 0.7);
      const baseHipX = 0.48 + 0.03 * Math.sin(t * 0.8);
      const baseHipY = 0.72 + 0.02 * Math.sin(t * 0.5);

      const respRate = Math.round(42 + 8 * Math.sin(t * 0.4));
      const heartRate = Math.round(136 + 12 * Math.sin(t * 0.6)); // Plausible synthetic newborn cardiac rhythm
      const stressScore = Number((24.0 + 12.0 * Math.cos(t * 0.3)).toFixed(1));
      const orientIndex = Math.floor((this.simulationStep / 8) % orientations.length);

      const syntheticPayload = {
        pose: {
          shoulder_position: [Number(baseShoulderX.toFixed(3)), Number(baseShoulderY.toFixed(3))],
          hip_position: [Number(baseHipX.toFixed(3)), Number(baseHipY.toFixed(3))],
          orientation: orientations[orientIndex]
        },
        vitals: {
          respiration_rate: respRate,
          heart_rate: heartRate,
          stress_score: stressScore,
          posture: orientIndex === 5 ? 'prone' : 'flexed',
          movement_status: Math.abs(Math.sin(t)) > 0.6 ? 'active' : 'normal'
        },
        timestamp: new Date().toISOString(),
        synthetic_note: 'DEMO_SYNTHETIC_DATA_ONLY'
      };

      this.processIncomingData(syntheticPayload);
    }, intervalMs);
  }

  /**
   * Stop live simulation
   */
  stopSimulation() {
    if (!this.isSimulating) return;
    clearInterval(this.simulationTimer);
    this.simulationTimer = null;
    this.isSimulating = false;
    console.log('DataManager: Stopped live simulation.');
  }

  /**
   * Reset data manager and avatar state
   */
  reset() {
    this.stopSimulation();
    this.lastProcessedTimestamp = 0;
    this.parser.resetCache();
    this.poseMapper.reset();
    this.avatar.reset();
    this.avatar.setHeartRate(null);
  }
}
