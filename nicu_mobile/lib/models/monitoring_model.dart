
import 'vitals_model.dart';
import 'pose_model.dart';
import 'alert_model.dart';

class MonitoringModel {
  final String? infantId;
  final int? timestamp;
  final VitalsModel? vitals;
  final PoseModel? pose;
  final AlertModel? alert;

  // Constructor
  const MonitoringModel({
    this.infantId,
    this.timestamp,
    this.vitals,
    this.pose,
    this.alert,
  });

  // Safely convert JSON objects into Dart maps
  static Map<String, dynamic>? _parseMap(dynamic value) {
    if (value is Map) {
      return Map<String, dynamic>.from(value);
    }
    return null;
  }

  // Convert complete JSON data into a MonitoringModel object
  factory MonitoringModel.fromJson(Map<String, dynamic> json) {
    final vitalsData = _parseMap(json['vitals']);
    final poseData = _parseMap(json['pose']);
    final alertData = _parseMap(json['alert']);

    return MonitoringModel(
      infantId: json['infant_id'] is String
          ? json['infant_id'] as String
          : null,

      timestamp: json['timestamp'] is num
          ? (json['timestamp'] as num).toInt()
          : null,

      vitals: vitalsData != null
          ? VitalsModel.fromJson(vitalsData)
          : null,

      pose: poseData != null
          ? PoseModel.fromJson(poseData)
          : null,

      alert: alertData != null
          ? AlertModel.fromJson(alertData)
          : null,
    );
  }

  // Convert MonitoringModel object back into JSON
  Map<String, dynamic> toJson() {
    return {
      'infant_id': infantId,
      'timestamp': timestamp,
      'vitals': vitals?.toJson(),
      'pose': pose?.toJson(),
      'alert': alert?.toJson(),
    };
  }
}
