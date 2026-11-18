
class PoseModel {
  final List<num>? shoulderPosition;
  final List<num>? hipPosition;
  final String? orientation;

  // Constructor
  const PoseModel({
    this.shoulderPosition,
    this.hipPosition,
    this.orientation,
  });

  // Safely convert JSON arrays into numeric lists
  static List<num>? _parsePosition(dynamic value) {
    if (value is List && value.every((item) => item is num)) {
      return value.cast<num>();
    }
    return null;
  }

  // Convert JSON data into a PoseModel object
  factory PoseModel.fromJson(Map<String, dynamic> json) {
    return PoseModel(
      shoulderPosition: _parsePosition(json['shoulder_position']),
      hipPosition: _parsePosition(json['hip_position']),
      orientation: json['orientation'] is String
          ? json['orientation'] as String
          : null,
    );
  }

  // Convert PoseModel object back into JSON
  Map<String, dynamic> toJson() {
    return {
      'shoulder_position': shoulderPosition,
      'hip_position': hipPosition,
      'orientation': orientation,
    };
  }
}
