import 'package:flutter_test/flutter_test.dart';
import 'package:nicu_mobile/models/monitoring_model.dart';
import 'package:nicu_mobile/models/vitals_model.dart';
import 'package:nicu_mobile/models/alert_model.dart';
import 'package:nicu_mobile/providers/monitoring_provider.dart';
import 'package:nicu_mobile/services/monitoring_service.dart';

class FakeMonitoringService extends MonitoringService {
  final bool shouldThrow;

  FakeMonitoringService({this.shouldThrow = false});

  @override
  Future<MonitoringModel> loadMockData() async {
    if (shouldThrow) {
      throw Exception('Simulated load error');
    }
    return const MonitoringModel(
      infantId: 'NICU_001',
      timestamp: 1794500000,
      vitals: VitalsModel(
        respirationRate: 45,
        stressScore: 25.5,
        posture: 'normal',
        movementStatus: 'normal',
        anomalyDetected: false,
      ),
      alert: AlertModel(
        isActive: false,
        severity: 'normal',
        message: null,
      ),
    );
  }
}

void main() {
  group('MonitoringProvider Unit Tests', () {
    test('Initial state is correct', () {
      final provider = MonitoringProvider(service: FakeMonitoringService());
      expect(provider.data, isNull);
      expect(provider.isLoading, isFalse);
      expect(provider.errorMessage, isNull);
      expect(provider.hasData, isFalse);
      expect(provider.isSimulatedStreamActive, isFalse);
      expect(provider.dataSourceLabel, contains('SIMULATED DATA'));
    });

    test('loadInitialData successfully updates telemetry', () async {
      final provider = MonitoringProvider(service: FakeMonitoringService());
      
      expect(provider.hasData, isFalse);
      await provider.loadInitialData();

      expect(provider.hasData, isTrue);
      expect(provider.isLoading, isFalse);
      expect(provider.data?.infantId, 'NICU_001');
      expect(provider.data?.vitals?.respirationRate, 45);
      expect(provider.errorMessage, isNull);
    });

    test('loadInitialData captures errors without crashing', () async {
      final provider = MonitoringProvider(service: FakeMonitoringService(shouldThrow: true));
      
      await provider.loadInitialData();

      expect(provider.hasData, isFalse);
      expect(provider.isLoading, isFalse);
      expect(provider.errorMessage, isNotNull);
      expect(provider.errorMessage, contains('Simulated load error'));
    });

    test('Simulation start and stop functions properly', () async {
      final provider = MonitoringProvider(service: FakeMonitoringService());
      await provider.loadInitialData();

      expect(provider.isSimulatedStreamActive, isFalse);
      provider.startSimulation(interval: const Duration(milliseconds: 50));
      expect(provider.isSimulatedStreamActive, isTrue);

      provider.stopSimulation();
      expect(provider.isSimulatedStreamActive, isFalse);
      provider.dispose();
    });

    test('updateFromExternalSource updates state and flags mock mode', () {
      final provider = MonitoringProvider(service: FakeMonitoringService());
      const externalData = MonitoringModel(infantId: 'NICU_999');

      provider.updateFromExternalSource(externalData);

      expect(provider.data?.infantId, 'NICU_999');
      expect(provider.isUsingMockData, isFalse);
    });
  });
}
