import 'dart:async';
import 'package:material_ui/material_ui.dart';
import '../models/monitoring_model.dart';
import '../models/vitals_model.dart';
import '../services/monitoring_service.dart';
import '../utils/constants.dart';

/// MonitoringProvider manages real-time/mock infant monitoring telemetry state.
/// 
/// Uses [ChangeNotifier] to broadcast data updates to subscribing UI widgets.
/// 
/// Academic Proof-of-Concept for College PBL Project.
/// All simulated data is strictly for academic and demonstration purposes.
class MonitoringProvider extends ChangeNotifier {
  final MonitoringService _service;

  MonitoringModel? _data;
  bool _isLoading = false;
  String? _errorMessage;
  bool _isSimulatedStreamActive = false;
  Timer? _simulationTimer;

  // Track whether data is from local mock or external stream
  bool _isUsingMockData = true;

  MonitoringProvider({MonitoringService? service})
      : _service = service ?? MonitoringService();

  // Getters for UI consumption
  MonitoringModel? get data => _data;
  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;
  bool get hasData => _data != null;
  bool get isSimulatedStreamActive => _isSimulatedStreamActive;
  bool get isUsingMockData => _isUsingMockData;

  String get dataSourceLabel => AppConstants.demoDataLabel;

  /// Loads initial telemetry data from MonitoringService.
  Future<void> loadInitialData() async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      _data = await _service.loadMockData();
      _isUsingMockData = true;
    } catch (e) {
      _errorMessage = 'Failed to load monitoring data: ${e.toString()}';
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  /// Refreshes telemetry data on-demand (e.g. for Android pull-to-refresh).
  Future<void> refresh() async {
    try {
      _data = await _service.loadMockData();
      _errorMessage = null;
    } catch (e) {
      _errorMessage = 'Refresh failed: ${e.toString()}';
    } finally {
      notifyListeners();
    }
  }

  /// Manually starts an optional mock stream simulation.
  /// Fluctuate values subtly to demonstrate reactive live updates in viva.
  /// Does NOT generate new clinical diagnoses or severe alarms.
  void startSimulation({Duration interval = const Duration(seconds: 3)}) {
    if (_isSimulatedStreamActive) return;

    _isSimulatedStreamActive = true;
    _simulationTimer?.cancel();

    _simulationTimer = Timer.periodic(interval, (timer) {
      if (_data == null) return;

      final currentVitals = _data?.vitals;
      if (currentVitals == null) return;

      // Small realistic demonstration variance (+1, -1, or 0)
      final step = (timer.tick % 3) - 1; // -1, 0, or 1
      final baseRate = currentVitals.respirationRate ?? 45;
      final newRate = (baseRate + step).clamp(
        AppConstants.normalMinRespirationRate,
        AppConstants.normalMaxRespirationRate,
      );

      final baseStress = currentVitals.stressScore ?? 25.0;
      final newStress = (baseStress + (step * 0.4)).clamp(10.0, 40.0);

      final updatedVitals = VitalsModel(
        respirationRate: newRate,
        stressScore: double.parse(newStress.toStringAsFixed(1)),
        posture: currentVitals.posture,
        movementStatus: currentVitals.movementStatus,
        anomalyDetected: currentVitals.anomalyDetected,
      );

      _data = MonitoringModel(
        infantId: _data?.infantId,
        timestamp: DateTime.now().millisecondsSinceEpoch ~/ 1000,
        vitals: updatedVitals,
        pose: _data?.pose,
        alert: _data?.alert,
      );

      notifyListeners();
    });

    notifyListeners();
  }

  /// Stops mock stream simulation.
  void stopSimulation() {
    _simulationTimer?.cancel();
    _simulationTimer = null;
    _isSimulatedStreamActive = false;
    notifyListeners();
  }

  /// Toggles simulation on/off for easy manual control.
  void toggleSimulation() {
    if (_isSimulatedStreamActive) {
      stopSimulation();
    } else {
      startSimulation();
    }
  }

  /// Future-proof hook for Phase 5 (Firebase Realtime Database live listener)
  void updateFromExternalSource(MonitoringModel newData) {
    _data = newData;
    _isUsingMockData = false;
    _errorMessage = null;
    notifyListeners();
  }

  @override
  void dispose() {
    _simulationTimer?.cancel();
    _simulationTimer = null;
    super.dispose();
  }
}
