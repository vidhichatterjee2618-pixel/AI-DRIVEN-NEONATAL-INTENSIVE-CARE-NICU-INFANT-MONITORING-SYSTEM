
import 'dart:convert';
import 'package:flutter/services.dart';
import '../models/monitoring_model.dart';

class MonitoringService {
  Future<MonitoringModel> loadMockData() async {
    // Read the JSON asset file
    final jsonString = await rootBundle.loadString(
      'assets/mock_data/infant_data.json',
    );

    // Convert JSON text into Dart data
    final Map<String, dynamic> jsonData = jsonDecode(jsonString);

    // Convert Dart data into our MonitoringModel
    return MonitoringModel.fromJson(jsonData);
  }
}
