
class VitalsModel {
  final num? respirationRate;
  final num? stressScore;
  final String? posture;
  final String? movementStatus;
  final bool? anomalyDetected;

  // Constructor
  const VitalsModel({
    this.respirationRate,
    this.stressScore,
    this.posture,
    this.movementStatus,
    this.anomalyDetected,
  });

  // Convert JSON data into a VitalsModel object
  factory VitalsModel.fromJson(Map<String, dynamic> json) {
    return VitalsModel(
      respirationRate: json['respiration_rate'] is num
          ? json['respiration_rate'] as num
          : null,

      stressScore: json['stress_score'] is num
          ? json['stress_score'] as num
          : null,

      posture: json['posture'] is String
          ? json['posture'] as String
          : null,

      movementStatus: json['movement_status'] is String
          ? json['movement_status'] as String
          : null,

      anomalyDetected: json['anomaly_detected'] is bool
          ? json['anomaly_detected'] as bool
          : null,
    );
  }

  // Convert a VitalsModel object back into JSON
  Map<String, dynamic> toJson() {
    return {
      'respiration_rate': respirationRate,
      'stress_score': stressScore,
      'posture': posture,
      'movement_status': movementStatus,
      'anomaly_detected': anomalyDetected,
    };
  }
}