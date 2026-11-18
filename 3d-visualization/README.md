# AI-Driven Neonatal Intensive Care (NICU) Infant Monitoring System
## 3D Real-Time Visualization Module

An interactive, WebGL-powered 3D visualization module for real-time neonatal intensive care monitoring. This module renders an anatomically plausible 3D newborn infant inside a clinical incubator environment, parses and validates incoming telemetry against a strict common JSON data contract, smoothly visualizes posture and orientation, drives dynamic respiration chest expansion, displays stress heatmap overlays, and provides direct adapters for Firebase Realtime Database and Firestore.

Designed as an independent, decoupled module for a college engineering PBL project that integrates with computer vision backends and cloud databases without depending on Flutter.

---

## 1. Quick Start & Execution Guide

The module can run on standard student laptops with zero mandatory Node.js setup using Python's built-in HTTP server, or with Vite if Node.js is installed.

### Option A: Direct Execution via Python (Recommended for Quick Testing)

1. Open PowerShell or Terminal and navigate to the project root:
   ```powershell
   cd C:\Users\HP\.gemini\antigravity\scratch\NICU_3D_Visualization
   ```
2. Start the local server on Port 3000:
   ```powershell
   python -m http.server 3000
   ```
3. Open your browser to:
   ```
   http://localhost:3000
   ```

### Option B: Execution via Vite & Node.js

1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the Vite development server:
   ```bash
   npm run dev
   ```
3. Open the printed local URL (typically `http://localhost:3000` or `http://localhost:5173`).

---

## 2. Project Directory Structure

```
NICU_3D_Visualization/
├── index.html                      # Clinical monitoring dashboard interface
├── package.json                    # Project metadata, run scripts, dependencies
├── vite.config.js                  # Vite configuration
├── .gitignore                      # Git exclusion rules for node_modules, env, build
├── .env.example                    # Firebase credentials and database path template
│
├── public/models/
│   ├── infant_avatar.glb           # Rigged 3D newborn avatar exported via Blender 5.3
│   └── infant_avatar.blend         # Master Blender 5.3 source file
│
├── src/
│   ├── main.js                     # Main entry point & event wiring
│   ├── scene.js                    # Three.js scene, lighting, incubator, OrbitControls
│   ├── avatar.js                   # Infant avatar loader, respiration, & stale visualizer
│   ├── poseMapper.js               # Normalized 2D coordinates to 3D pose & axial roll mapper
│   ├── jsonParser.js               # Strict JSON contract parser & validator
│   ├── indicators.js               # UI telemetry badges, meter bars, & alert console
│   ├── stressHeatmap.js            # Configurable stress indicator & 3D heatmap shader
│   ├── dataManager.js              # Central telemetry coordinator & synthetic live simulator
│   ├── firebaseService.js          # Direct Firebase adapter with exponential backoff
│   └── styles/
│       └── style.css               # Clinical dark-theme responsive dashboard styles
│
├── mock/
│   ├── monitoring_data.json        # Baseline agreed JSON telemetry contract
│   └── mock_test_cases.json        # Complete Section 16 test suite (12 edge scenarios)
│
├── create_avatar.py                # Headless Blender 5.3 Python generation script
├── test_suite.py                   # Automated verification test suite
└── README.md                       # Complete technical documentation
```

---

## 3. Agreed Common JSON Data Contract

The visualization strictly enforces the team's agreed JSON schema:

```json
{
  "pose": {
    "shoulder_position": [0.45, 0.32],
    "hip_position": [0.48, 0.72],
    "orientation": "supine"
  },
  "vitals": {
    "respiration_rate": 45,
    "stress_score": 25.5,
    "posture": "normal",
    "movement_status": "normal"
  }
}
```

### Telemetry Field Definitions

| Section | Field | Type | Valid Range / Format | Description |
| :--- | :--- | :--- | :--- | :--- |
| `pose` | `shoulder_position` | `[number, number]` or `null` | `0.0 <= x, y <= 1.0` | Normalized 2D coordinates of shoulder midpoint. Image $Y$ increases downward. |
| `pose` | `hip_position` | `[number, number]` or `null` | `0.0 <= x, y <= 1.0` | Normalized 2D coordinates of hip midpoint. Image $Y$ increases downward. |
| `pose` | `orientation` | `string` | `"supine"`, `"prone"`, `"left lateral"`, `"right lateral"`, `"unknown"` | Axial body roll orientation on incubator mattress. |
| `vitals` | `respiration_rate` | `number` or `null` | `>= 0` | Numerical respiration rate (breaths/minute). Controls chest wall animation. |
| `vitals` | `heart_rate` *(optional)* | `number` or `null` | `>= 0` | Optional neonatal cardiac rate (BPM). Synchronizes precordial pulse animation. If omitted, marks `"Not Supplied"` without error. |
| `vitals` | `stress_score` | `number` or `null` | Configurable (default $0.0 \text{--} 100.0$) | Overall neonatal stress index. Modulates 3D skin heatmap. |
| `vitals` | `posture` | `string` or `null` | e.g. `"normal"`, `"flexed"`, `"curled"` | Clinical posture indicator tag. |
| `vitals` | `movement_status` | `string` or `null` | e.g. `"normal"`, `"active"`, `"rest"` | Clinical movement status tag. |

---

## 4. Core Architecture & Module Breakdown

### 1. `src/scene.js` (Three.js 3D Environment)
- Configures high-performance WebGL renderer with antialiasing, ACESFilmic tone mapping, and soft shadow maps.
- Sets up medical examination lighting: soft ambient clinical fill, key surgical spotlight, and cyan rim light.
- Renders a realistic neonatal incubator environment: incubator base, mattress with grid alignment guides, transparent acrylic hood, and status LED ring.
- Provides interactive `OrbitControls` with safety pitch limits and camera angle presets (`Top View`, `Side View`, `Front View`, `Reset`).

### 2. `src/avatar.js` (Infant Avatar & Visualizers)
- Loads the rigged GLB model (`models/infant_avatar.glb`) and includes an immediate procedural newborn mesh fallback for instant rendering.
- Follows realistic neonatal proportions: large cranial-to-body ratio (~1:4), rounded ribcage and abdomen, and physiologically flexed limbs.
- **Respiration Animation**: Modulates chest mesh scale using a sinusoidal expansion function driven by incoming `respiration_rate`. Smoothly returns to baseline resting scale ($1.0$) when respiration telemetry is absent or null.
- **Stale Tracking Indicator**: When landmarks are missing or stale, pulses avatar material opacity to visibly flag that tracking is preserved but stale.

### 3. `src/poseMapper.js` (Coordinate & Orientation Mapping)
- Converts normalized camera coordinates $(x, y) \in [0, 1]$ into 3D incubator coordinates $(X, Y, Z)$:
  $$\text{3D } X = (x - 0.5) \times \text{bedWidth}$$
  $$\text{3D } Z = (y - 0.5) \times \text{bedLength}$$
- Properly accounts for the inverted image vertical axis ($Y$ downward) so head maps to $-Z$ and feet to $+Z$.
- Computes in-plane trunk heading (yaw) when both shoulders and hips are available.
- Handles missing landmarks independently without fabricating phantom coordinates.
- Maps body orientation into axial roll ($0^\circ$ for supine, $180^\circ$ for prone, $+90^\circ$ for left lateral, $-90^\circ$ for right lateral).
- Employs shortest-path angular delta interpolation to ensure smooth transitions without 360-degree flip glitches.

### 4. `src/jsonParser.js` (Strict Schema Validator)
- Accepts both raw JSON strings and JavaScript objects safely without throwing unhandled exceptions.
- Validates coordinate array bounds ($0.0 \le \text{coord} \le 1.0$).
- Strictly distinguishes between **zero readings** (`respiration_rate: 0`) and **unavailable readings** (`null`/`undefined`).
- Caches the last known valid pose and tags `isStale: true` when subsequent readings lack coordinates.
- Emits structured diagnoses, error logs, and warnings for display in the developer console.

### 5. `src/stressHeatmap.js` (Stress Overlay)
- Configurable score scale without hardcoding arbitrary clinical severity claims.
- Translates a single global stress score into a global avatar material color overlay, strictly avoiding fabricated localized hotspots.
- Features a smooth three-stop color gradient:
  $$\text{Calm Sage/Teal } (\#\text{b2dfdb}) \longrightarrow \text{Baseline Neonatal Skin } (\#\text{e8c6b4}) \longrightarrow \text{Elevated Rose/Coral } (\#\text{f87171})$$
- Designed with an extensible interface (`setRegionScore`) ready to accept future multi-zone stress telemetry.

### 6. `src/dataManager.js` (Central Telemetry Coordinator)
- Dispatches parsed packets to the 3D avatar, pose mapper, and UI indicator elements.
- **Sequence & Timestamp Guard**: Drops out-of-order packets if their timestamp is older than the last processed reading.
- Avoids scene reloads: updates only mesh transform targets and material colors at 60 FPS.
- Provides a synthetic live simulation mode that generates physiologically plausible oscillations, clearly tagged with `"DEMO_SYNTHETIC_DATA_ONLY"`.

### 7. `src/firebaseService.js` (Cloud Integration Adapter)
- Listens directly to Firebase Realtime Database or Firestore at path `nicu/live_monitoring`.
- Completely decoupled from Flutter: feeds data directly to `dataManager.js`.
- Features automatic reconnection with exponential backoff.
- Zero hardcoded credentials: reads configuration from environment variables (`.env`) or runtime `window.NICU_FIREBASE_CONFIG`.
- Automatically operates in a zero-credential **Standby Mock Mode** without errors or crashes.

---

## 5. How Backend Teammates Can Send Telemetry

Your Python backend (computer vision or telemetry pipeline) can push data using either of the methods below:

### Method 1: Direct Push to Firebase Realtime Database (Cloud Mode)

Ensure your Python environment has `firebase-admin` installed (`pip install firebase-admin`):

```python
import time
import firebase_admin
from firebase_admin import credentials, db

# 1. Initialize Firebase Admin SDK
cred = credentials.Certificate("path/to/serviceAccountKey.json")
firebase_admin.initialize_app(cred, {
    "databaseURL": "https://your-project-default-rtdb.firebaseio.com"
})

# 2. Reference the agreed telemetry path
telemetry_ref = db.reference("nicu/live_monitoring")

def send_telemetry(shoulder_xy, hip_xy, orientation, respiration_bpm, stress_val, posture_str, movement_str):
    payload = {
        "pose": {
            "shoulder_position": shoulder_xy,  # e.g. [0.45, 0.32] or None
            "hip_position": hip_xy,            # e.g. [0.48, 0.72] or None
            "orientation": orientation         # "supine" | "prone" | "left lateral" | "right lateral"
        },
        "vitals": {
            "respiration_rate": respiration_bpm, # e.g. 45
            "stress_score": stress_val,          # e.g. 25.5
            "posture": posture_str,              # e.g. "normal"
            "movement_status": movement_str      # e.g. "normal"
        },
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime())
    }
    
    # Push update to Firebase
    telemetry_ref.set(payload)
    print(f"Telemetry sent: RR={respiration_bpm}, Stress={stress_val}, Orient={orientation}")

# Example streaming loop
if __name__ == "__main__":
    send_telemetry(
        shoulder_xy=[0.45, 0.32],
        hip_xy=[0.48, 0.72],
        orientation="supine",
        respiration_bpm=45,
        stress_val=25.5,
        posture_str="normal",
        movement_str="normal"
    )
```

### Method 2: Testing Directly in the Web Dashboard

Team members testing without Firebase credentials can:
1. Click **"Load Agreed Mock Data"** to load the default baseline contract.
2. Select any of the 12 edge cases from the **"Run Edge Case Test"** dropdown.
3. Click **"Inject Custom JSON"**, paste any raw JSON payload, and click **Validate & Inject** to verify how the 3D avatar and indicators react.

---

## 6. Architectural Limitations & Future Enhancements

### Current Limitations
1. **Two-Landmark Posture Approximation**:
   - The agreed contract provides two 2D landmarks: `shoulder_position` and `hip_position`.
   - Mathematically, two landmarks can determine position and longitudinal trunk alignment, but cannot determine individual elbow, wrist, knee, or ankle angles.
   - The module intentionally avoids fabricating phantom joint angles.
2. **Stress Interpretation Scale**:
   - Stress score is presented on a configurable visualization spectrum ($0 \text{--} 100$) without claiming diagnostic clinical thresholds.
3. **Global vs. Regional Stress**:
   - The single incoming stress metric is rendered uniformly across the infant avatar to avoid fabricating localized stress in specific body parts.

### Future Enhancements
1. **MediaPipe Full Skeletal Rigging**:
   - When the computer vision team incorporates full 33-point MediaPipe keypoints, the avatar's bone hierarchy (`UpperArm`, `Forearm`, `Thigh`, `Shin`) is already structured in `src/avatar.js` to receive 3D rotational matrices directly.
2. **Multi-Zone Thermal/Stress Mapping**:
   - `src/stressHeatmap.js` contains a `regionScores` dictionary ready to accept localized heatmaps (cranial, thoracic, abdominal, extremity) once supported by the backend.
3. **WebRTC Direct Stream**:
   - Capability to stream live video side-by-side with the 3D digital twin visualization.
