/**
 * stressHeatmap.js
 * Modular stress indicator and 3D avatar heatmap shader/material overlay.
 *
 * Requirements (Section 11):
 * - Score range is fully configurable (default [0, 100], without clinical claims).
 * - A single global stress score is represented as a global visual indicator,
 *   never fabricating localized hotspots in individual body regions.
 * - Extensible architecture ready to support future region-specific stress maps.
 * - Smooth color transitions via delta-time interpolation.
 */

import * as THREE from 'three';

export class StressHeatmap {
  constructor(config = {}) {
    // Configurable score range (Section 11: Do not assume 0-100 unless confirmed)
    this.scoreMin = config.scoreMin !== undefined ? config.scoreMin : 0.0;
    this.scoreMax = config.scoreMax !== undefined ? config.scoreMax : 100.0;

    // Current state
    this.currentScore = null;
    this.isAvailable = false;

    // Palette Colors (Neutral, professional visualization scale)
    // Low / Calm spectrum: Soft Sage / Teal tint
    this.colorCalm = new THREE.Color(config.colorCalm || 0xb2dfdb);
    // Baseline spectrum: Soft natural neonatal tone
    this.colorBaseline = new THREE.Color(config.colorBaseline || 0xe8c6b4);
    // Elevated spectrum: Soft Coral / Warm Rose tint
    this.colorElevated = new THREE.Color(config.colorElevated || 0xf87171);

    // Active color values for smooth interpolation
    this.currentColor = this.colorBaseline.clone();
    this.targetColor = this.colorBaseline.clone();

    // Registered materials to modulate
    this.registeredMaterials = new Set();

    // Extensibility: Region-specific stress scores dictionary for future expansion
    this.regionScores = {
      head: null,
      chest: null,
      abdomen: null,
      limbs: null
    };
  }

  /**
   * Register a Three.js material to receive global heatmap color modulation
   * @param {THREE.Material} material
   */
  registerMaterial(material) {
    if (material && material.color) {
      this.registeredMaterials.add(material);
    }
  }

  /**
   * Unregister a material
   */
  unregisterMaterial(material) {
    this.registeredMaterials.delete(material);
  }

  /**
   * Update the incoming global stress score.
   * @param {number|null} score Numerical stress metric from JSON telemetry
   */
  setStressScore(score) {
    if (score === null || score === undefined || isNaN(score)) {
      this.currentScore = null;
      this.isAvailable = false;
      // When unavailable, revert target smoothly to baseline skin
      this.targetColor.copy(this.colorBaseline);
      return {
        available: false,
        score: null,
        normalizedFactor: null,
        displayLabel: 'Unavailable'
      };
    }

    this.currentScore = Number(score);
    this.isAvailable = true;

    // Calculate normalized factor in [0.0, 1.0] relative to configurable range
    const clamped = Math.max(this.scoreMin, Math.min(this.scoreMax, this.currentScore));
    const range = this.scoreMax - this.scoreMin;
    const factor = range > 0 ? (clamped - this.scoreMin) / range : 0.5;

    // Smooth three-stop color gradient interpolation
    if (factor < 0.5) {
      // Lower half: Calm -> Baseline
      const t = factor / 0.5;
      this.targetColor.copy(this.colorCalm).lerp(this.colorBaseline, t);
    } else {
      // Upper half: Baseline -> Elevated
      const t = (factor - 0.5) / 0.5;
      this.targetColor.copy(this.colorBaseline).lerp(this.colorElevated, t);
    }

    let displayLabel = 'Baseline';
    if (factor < 0.35) displayLabel = 'Low Index';
    else if (factor > 0.65) displayLabel = 'Elevated Index';

    return {
      available: true,
      score: this.currentScore,
      normalizedFactor: factor,
      displayLabel
    };
  }

  /**
   * Configure the score range dynamically from backend configuration
   * @param {number} min Minimum scale boundary
   * @param {number} max Maximum scale boundary
   */
  configureRange(min, max) {
    if (typeof min === 'number' && typeof max === 'number' && min < max) {
      this.scoreMin = min;
      this.scoreMax = max;
      if (this.currentScore !== null) {
        this.setStressScore(this.currentScore);
      }
    } else {
      console.warn(`StressHeatmap: Invalid range configuration [${min}, ${max}]`);
    }
  }

  /**
   * Support future region-specific stress telemetry without fabricating values today
   * @param {string} region 'head' | 'chest' | 'abdomen' | 'limbs'
   * @param {number|null} score
   */
  setRegionScore(region, score) {
    if (this.regionScores.hasOwnProperty(region)) {
      this.regionScores[region] = score;
    }
  }

  /**
   * Per-frame animation tick for smooth color transitions
   * @param {number} deltaTime Time elapsed in seconds
   */
  update(deltaTime = 0.016) {
    // Smooth lerp towards target color
    const lerpRate = Math.min(1.0, deltaTime * 4.0);
    this.currentColor.lerp(this.targetColor, lerpRate);

    // Apply interpolated color to all registered avatar materials
    for (const mat of this.registeredMaterials) {
      if (mat && mat.color) {
        mat.color.copy(this.currentColor);
      }
    }
  }

  /**
   * Reset to baseline neutral color
   */
  reset() {
    this.currentScore = null;
    this.isAvailable = false;
    this.targetColor.copy(this.colorBaseline);
    this.currentColor.copy(this.colorBaseline);
    for (const mat of this.registeredMaterials) {
      if (mat && mat.color) {
        mat.color.copy(this.colorBaseline);
      }
    }
  }
}
