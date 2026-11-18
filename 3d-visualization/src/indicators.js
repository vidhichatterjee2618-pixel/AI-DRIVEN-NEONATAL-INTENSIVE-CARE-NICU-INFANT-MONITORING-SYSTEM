/**
 * indicators.js
 * Manages the UI status indicators, numeric vital badges, stress legend,
 * posture and movement tags, tracking health, and error alerts.
 */

export class IndicatorsManager {
  constructor() {
    // DOM Elements
    this.elRespirationVal = document.getElementById('val-respiration');
    this.elRespirationStatus = document.getElementById('status-respiration');
    this.elHeartVal = document.getElementById('val-heartrate');
    this.elHeartStatus = document.getElementById('status-heartrate');
    this.elHeartIcon = document.getElementById('icon-heartbeat');
    this.elStressVal = document.getElementById('val-stress');
    this.elStressBar = document.getElementById('stress-meter-bar');
    this.elStressLabel = document.getElementById('status-stress');
    this.elPostureVal = document.getElementById('val-posture');
    this.elMovementVal = document.getElementById('val-movement');
    this.elOrientationVal = document.getElementById('val-orientation');
    this.elTrackingStatus = document.getElementById('status-tracking');
    this.elLastTimestamp = document.getElementById('val-timestamp');
    this.elErrorMessage = document.getElementById('alert-console');
  }

  /**
   * Update all indicators with parsed data and validation diagnosis
   */
  update(parsedResult) {
    if (!parsedResult) return;

    const { success, data, errors, warnings } = parsedResult;

    // 1. Errors & Warnings Alert Console
    this._renderAlerts(errors, warnings);

    if (!data) return;

    const { pose, vitals, timestamp } = data;

    // 2. Respiration Rate
    if (vitals && vitals.respiration_available) {
      this.elRespirationVal.textContent = vitals.respiration_rate;
      this.elRespirationVal.classList.remove('text-muted');
      this.elRespirationStatus.textContent = 'Active Breathing';
      this.elRespirationStatus.className = 'status-tag status-active';
    } else {
      this.elRespirationVal.textContent = '--';
      this.elRespirationVal.classList.add('text-muted');
      this.elRespirationStatus.textContent = 'Unavailable';
      this.elRespirationStatus.className = 'status-tag status-unavailable';
    }

    // 3. Heart Rate (Optional vitals.heart_rate)
    if (this.elHeartVal) {
      if (vitals && vitals.heart_rate_available) {
        this.elHeartVal.textContent = vitals.heart_rate;
        this.elHeartVal.classList.remove('text-muted');
        if (this.elHeartStatus) {
          this.elHeartStatus.textContent = 'Active Rhythm';
          this.elHeartStatus.className = 'status-tag status-active';
        }
        if (this.elHeartIcon) {
          this.elHeartIcon.classList.add('heart-pulsing');
          const durationSec = (60.0 / Math.max(1, vitals.heart_rate)).toFixed(2);
          this.elHeartIcon.style.animationDuration = `${durationSec}s`;
        }
      } else {
        this.elHeartVal.textContent = '--';
        this.elHeartVal.classList.add('text-muted');
        if (this.elHeartStatus) {
          this.elHeartStatus.textContent = 'Not Supplied';
          this.elHeartStatus.className = 'status-tag status-unavailable';
        }
        if (this.elHeartIcon) {
          this.elHeartIcon.classList.remove('heart-pulsing');
          this.elHeartIcon.style.animationDuration = '0s';
        }
      }
    }

    // 4. Stress Score & Meter Bar
    if (vitals && vitals.stress_available) {
      this.elStressVal.textContent = Number(vitals.stress_score).toFixed(1);
      this.elStressVal.classList.remove('text-muted');
      
      // Calculate meter percentage (0-100 baseline range)
      const pct = Math.max(0, Math.min(100, (vitals.stress_score / 100) * 100));
      this.elStressBar.style.width = `${pct}%`;

      if (pct < 35) {
        this.elStressBar.style.backgroundColor = '#10b981'; // green / calm
        this.elStressLabel.textContent = 'Low Index';
      } else if (pct < 70) {
        this.elStressBar.style.backgroundColor = '#f59e0b'; // amber / moderate
        this.elStressLabel.textContent = 'Moderate Index';
      } else {
        this.elStressBar.style.backgroundColor = '#ef4444'; // coral / high
        this.elStressLabel.textContent = 'Elevated Index';
      }
    } else {
      this.elStressVal.textContent = '--';
      this.elStressVal.classList.add('text-muted');
      this.elStressBar.style.width = '0%';
      this.elStressLabel.textContent = 'Unavailable';
    }

    // 4. Posture Status
    if (vitals && vitals.posture && vitals.posture !== 'Unavailable') {
      this.elPostureVal.textContent = vitals.posture.toUpperCase();
      this.elPostureVal.className = 'badge badge-normal';
    } else {
      this.elPostureVal.textContent = 'UNAVAILABLE';
      this.elPostureVal.className = 'badge badge-unavailable';
    }

    // 5. Movement Status
    if (vitals && vitals.movement_status && vitals.movement_status !== 'Unavailable') {
      this.elMovementVal.textContent = vitals.movement_status.toUpperCase();
      this.elMovementVal.className = 'badge badge-normal';
    } else {
      this.elMovementVal.textContent = 'UNAVAILABLE';
      this.elMovementVal.className = 'badge badge-unavailable';
    }

    // 6. Orientation
    if (pose && pose.orientation) {
      this.elOrientationVal.textContent = pose.orientation.toUpperCase();
    } else {
      this.elOrientationVal.textContent = 'UNKNOWN';
    }

    // 7. Tracking Health & Pose Staleness
    if (pose) {
      if (pose.isStale) {
        this.elTrackingStatus.textContent = 'Pose Preserved (Stale Data)';
        this.elTrackingStatus.className = 'status-tag status-warning';
      } else if (pose.shoulderAvailable && pose.hipAvailable) {
        this.elTrackingStatus.textContent = 'Full Landmark Tracking (2/2)';
        this.elTrackingStatus.className = 'status-tag status-active';
      } else if (pose.shoulderAvailable || pose.hipAvailable) {
        this.elTrackingStatus.textContent = 'Partial Tracking (1/2)';
        this.elTrackingStatus.className = 'status-tag status-warning';
      } else {
        this.elTrackingStatus.textContent = 'Landmarks Unavailable';
        this.elTrackingStatus.className = 'status-tag status-unavailable';
      }
    }

    // 8. Timestamp
    if (timestamp) {
      const d = new Date(timestamp);
      this.elLastTimestamp.textContent = d.toLocaleTimeString() + '.' + String(d.getMilliseconds()).padStart(3, '0');
    }
  }

  _renderAlerts(errors, warnings) {
    if (!this.elErrorMessage) return;

    if (errors.length === 0 && warnings.length === 0) {
      this.elErrorMessage.innerHTML = '<span class="log-ok">● All JSON contracts validated successfully. Zero errors.</span>';
      return;
    }

    let html = '';
    for (const err of errors) {
      html += `<div class="log-item log-error"><strong>ERROR:</strong> ${err}</div>`;
    }
    for (const warn of warnings) {
      html += `<div class="log-item log-warning"><strong>WARNING:</strong> ${warn}</div>`;
    }
    this.elErrorMessage.innerHTML = html;
  }
}
