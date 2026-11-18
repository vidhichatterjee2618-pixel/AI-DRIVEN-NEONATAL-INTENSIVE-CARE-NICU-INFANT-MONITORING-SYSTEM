
import 'dart:convert';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nicu_mobile/models/monitoring_model.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test('Load and parse NICU mock JSON correctly', () async {
    // Load the JSON file from assets
    final jsonString = await rootBundle.loadString(
      'assets/mock_data/infant_data.json',
    );

    // Convert JSON string into a Dart Map
    final Map<String, dynamic> jsonData = jsonDecode(jsonString);

    // Convert the Map into MonitoringModel
    final monitoring = MonitoringModel.fromJson(jsonData);

    // Verify the parsed values
    expect(monitoring.infantId, 'NICU_001');
    expect(monitoring.vitals?.respirationRate, 45);
    expect(monitoring.pose?.orientation, 'supine');
    expect(monitoring.alert?.isActive, false);
  });
}
