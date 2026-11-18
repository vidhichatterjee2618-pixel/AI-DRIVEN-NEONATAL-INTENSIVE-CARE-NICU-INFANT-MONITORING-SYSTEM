
class AlertModel {
  final bool? isActive;
  final String? severity;
  final String? message;

  // Constructor
  const AlertModel({
    this.isActive,
    this.severity,
    this.message,
  });

  // Convert JSON data into an AlertModel object
  factory AlertModel.fromJson(Map<String, dynamic> json) {
    return AlertModel(
      isActive: json['is_active'] is bool
          ? json['is_active'] as bool
          : null,

      severity: json['severity'] is String
          ? json['severity'] as String
          : null,

      message: json['message'] is String
          ? json['message'] as String
          : null,
    );
  }

  // Convert AlertModel object back into JSON
  Map<String, dynamic> toJson() {
    return {
      'is_active': isActive,
      'severity': severity,
      'message': message,
    };
  }
}
