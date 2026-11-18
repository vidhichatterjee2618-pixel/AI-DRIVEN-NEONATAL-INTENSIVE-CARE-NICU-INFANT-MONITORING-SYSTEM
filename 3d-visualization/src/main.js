/**
 * main.js
 * Application entry point for AI-Driven NICU 3D Visualization Module.
 * Integrates Scene, Avatar, PoseMapper, DataManager, FirebaseService, and UI controls.
 */

import { NICUScene } from './scene.js';
import { InfantAvatar } from './avatar.js';
import { PoseMapper } from './poseMapper.js';
import { IndicatorsManager } from './indicators.js';
import { DataManager } from './dataManager.js';
import { FirebaseService } from './firebaseService.js';

window.addEventListener('DOMContentLoaded', async () => {
  console.log('Initializing NICU 3D Visualization Module...');

  // DOM Elements Query
  const testSelector = document.getElementById('select-test-case');
  const btnLoadMock = document.getElementById('btn-load-mock');
  const btnSimulate = document.getElementById('btn-simulate');
  const btnReset = document.getElementById('btn-reset');
  const modal = document.getElementById('json-modal');
  const btnOpenModal = document.getElementById('btn-open-json-modal');
  const btnCloseModal = document.getElementById('btn-close-json-modal');
  const btnInjectJson = document.getElementById('btn-inject-json');
  const jsonTextarea = document.getElementById('custom-json-input');
  const elFirebaseStatus = document.getElementById('badge-firebase');

  // 1. Initialize 3D Scene
  const container = document.getElementById('canvas3d-container');
  const nicuScene = new NICUScene(container);

  // 2. Initialize Infant Avatar
  const avatar = new InfantAvatar(nicuScene);

  // 3. Initialize Pose Mapper
  const poseMapper = new PoseMapper({
    bedWidth: 0.36,
    bedLength: 0.60,
    bedBaseY: 0.05,
    lerpSpeed: 4.5
  });

  // 4. Initialize UI Indicators
  const indicators = new IndicatorsManager();

  // 5. Initialize Central Data Manager
  const dataManager = new DataManager({
    poseMapper,
    avatar,
    indicators
  });

  // 6. Initialize Firebase Adapter
  const firebaseService = new FirebaseService(dataManager);

  firebaseService.onStatusChange = (status, msg) => {
    if (!elFirebaseStatus) return;
    elFirebaseStatus.textContent = `FB: ${status.toUpperCase()}`;
    if (status === 'connected') {
      elFirebaseStatus.className = 'status-tag status-active';
    } else if (status === 'connecting' || status === 'reconnecting') {
      elFirebaseStatus.className = 'status-tag status-warning';
    } else {
      elFirebaseStatus.className = 'status-tag status-unavailable';
    }
    console.log(`[FirebaseService] ${status}: ${msg}`);
  };

  // Attempt connection (will safely run in mock mode if unconfigured)
  firebaseService.connect();

  // Bind frame update: continuously interpolate avatar transform from poseMapper
  nicuScene.addUpdateCallback((dt) => {
    const interpolatedTransform = poseMapper.update(dt);
    avatar.setPose(interpolatedTransform);
  });

  // 7. Load Agreed Baseline Mock Data Initially
  let baselineMockData = null;
  let testCasesCollection = [];

  try {
    const res = await fetch('mock/monitoring_data.json');
    if (res.ok) {
      baselineMockData = await res.json();
      console.log('Loaded baseline mock data contract:', baselineMockData);
      dataManager.processIncomingData(baselineMockData);
    }
  } catch (err) {
    console.warn('Initial mock data fetch notice:', err.message);
  }

  // 8. Load Test Cases Suite
  try {
    const resCases = await fetch('mock/mock_test_cases.json');
    if (resCases.ok) {
      const casesJson = await resCases.json();
      testCasesCollection = casesJson.test_cases || [];
      _populateTestCaseSelector(testCasesCollection);
    }
  } catch (err) {
    console.warn('Test cases fetch notice:', err.message);
  }

  // 9. Wire Up UI Action Buttons
  // Button: Load Agreed Mock Data
  if (btnLoadMock) {
    btnLoadMock.addEventListener('click', async () => {
      dataManager.stopSimulation();
      _updateSimButtonUI(false);
      if (baselineMockData) {
        dataManager.processIncomingData(baselineMockData);
      } else {
        dataManager.processIncomingData({
          pose: {
            shoulder_position: [0.45, 0.32],
            hip_position: [0.48, 0.72],
            orientation: 'supine'
          },
          vitals: {
            respiration_rate: 45,
            stress_score: 25.5,
            posture: 'normal',
            movement_status: 'normal'
          }
        });
      }
    });
  }

  // Button: Simulate Live Monitoring
  if (btnSimulate) {
    btnSimulate.addEventListener('click', () => {
      if (dataManager.isSimulating) {
        dataManager.stopSimulation();
        _updateSimButtonUI(false);
      } else {
        dataManager.startSimulation(1200);
        _updateSimButtonUI(true);
      }
    });
  }

  // Button: Reset Avatar & Camera View
  if (btnReset) {
    btnReset.addEventListener('click', () => {
      dataManager.reset();
      nicuScene.setCameraPreset('reset');
      _updateSimButtonUI(false);
      if (baselineMockData) {
        dataManager.processIncomingData(baselineMockData);
      }
    });
  }

  // Camera Presets Buttons
  document.querySelectorAll('[data-cam-preset]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const preset = e.target.getAttribute('data-cam-preset');
      nicuScene.setCameraPreset(preset);
    });
  });

  // Test Case Dropdown Selector
  if (testSelector) {
    testSelector.addEventListener('change', (e) => {
      const selectedId = e.target.value;
      if (!selectedId) return;

      const foundCase = testCasesCollection.find((tc) => tc.id === selectedId);
      if (foundCase) {
        dataManager.stopSimulation();
        _updateSimButtonUI(false);

        if (foundCase.raw_string) {
          dataManager.processIncomingData(foundCase.raw_string);
        } else if (foundCase.data) {
          dataManager.processIncomingData(foundCase.data);
        }
      }
    });
  }

  // Custom Raw JSON Modal
  if (btnOpenModal && modal) {
    btnOpenModal.addEventListener('click', () => {
      modal.style.display = 'flex';
      if (!jsonTextarea.value.trim() && baselineMockData) {
        jsonTextarea.value = JSON.stringify(baselineMockData, null, 2);
      }
    });
  }

  if (btnCloseModal && modal) {
    btnCloseModal.addEventListener('click', () => {
      modal.style.display = 'none';
    });
  }

  if (btnInjectJson && jsonTextarea) {
    btnInjectJson.addEventListener('click', () => {
      const rawText = jsonTextarea.value.trim();
      dataManager.stopSimulation();
      _updateSimButtonUI(false);
      dataManager.processIncomingData(rawText);
      modal.style.display = 'none';
    });
  }

  // Helper: populate test cases dropdown
  function _populateTestCaseSelector(cases) {
    const elSelector = testSelector || document.getElementById('select-test-case');
    if (!elSelector) return;
    elSelector.innerHTML = '<option value="">-- Run Edge Case Test (Section 16) --</option>';
    for (const c of cases) {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = c.name;
      elSelector.appendChild(opt);
    }
    console.log(`Populated test cases dropdown with ${cases.length} edge scenarios.`);
  }

  // Helper: update Simulation button state styling
  function _updateSimButtonUI(isActive) {
    if (!btnSimulate) return;
    if (isActive) {
      btnSimulate.classList.add('btn-sim-active');
      btnSimulate.innerHTML = '<span>⏸</span> Pause Simulation';
      document.getElementById('badge-mode').textContent = 'SYNTHETIC LIVE';
      document.getElementById('badge-mode').style.color = '#f43f5e';
      document.getElementById('badge-mode').style.borderColor = '#f43f5e';
    } else {
      btnSimulate.classList.remove('btn-sim-active');
      btnSimulate.innerHTML = '<span>▶</span> Simulate Live Monitoring';
      document.getElementById('badge-mode').textContent = 'MOCK TELEMETRY';
      document.getElementById('badge-mode').style.color = '#10b981';
      document.getElementById('badge-mode').style.borderColor = 'rgba(16, 185, 129, 0.4)';
    }
  }

  console.log('NICU 3D Visualization Module initialized successfully.');
});
