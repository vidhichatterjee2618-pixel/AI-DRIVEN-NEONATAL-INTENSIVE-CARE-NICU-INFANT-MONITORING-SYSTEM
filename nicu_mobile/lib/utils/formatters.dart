import 'package:material_ui/material_ui.dart';
import 'constants.dart';

/// Helper methods to safely format data types and timestamps
/// for the NICU dashboard UI without throwing exceptions or showing raw nulls.
class AppFormatters {
  /// Converts a Unix timestamp (seconds since epoch) into a readable date/time string.
  /// Example: 1794500000 -> "12:53:20 • 14 Nov 2026"
  /// Returns '--' if the timestamp is null or invalid.
  static String formatTimestamp(int? timestamp) {
    if (timestamp == null || timestamp <= 0) {
      return '--:--';
    }

    try {
      final dateTime = DateTime.fromMillisecondsSinceEpoch(timestamp * 1000);
      final hour = dateTime.hour.toString().padLeft(2, '0');
      final minute = dateTime.minute.toString().padLeft(2, '0');
      final second = dateTime.second.toString().padLeft(2, '0');
      final day = dateTime.day.toString().padLeft(2, '0');
      final month = _monthName(dateTime.month);
      final year = dateTime.year.toString();

      return '$hour:$minute:$second • $day $month $year';
    } catch (_) {
      return '--:--';
    }
  }

  /// Short time format: "12:53:20"
  static String formatTimeOnly(int? timestamp) {
    if (timestamp == null || timestamp <= 0) {
      return '--:--:--';
    }
    try {
      final dateTime = DateTime.fromMillisecondsSinceEpoch(timestamp * 1000);
      final hour = dateTime.hour.toString().padLeft(2, '0');
      final minute = dateTime.minute.toString().padLeft(2, '0');
      final second = dateTime.second.toString().padLeft(2, '0');
      return '$hour:$minute:$second';
    } catch (_) {
      return '--:--:--';
    }
  }

  /// Formats respiration rate with unit: "45 bpm" or "-- bpm"
  static String formatRespirationRate(num? rate) {
    if (rate == null) return '-- bpm';
    return '${rate.toInt()} bpm';
  }

  /// Formats stress score: "25.5 / 100" or "--"
  static String formatStressScore(num? score) {
    if (score == null) return '--';
    return '${score.toStringAsFixed(1)} / 100';
  }

  /// Capitalizes text for cleaner display: "supine" -> "Supine", "normal" -> "Normal"
  static String capitalize(String? text) {
    if (text == null || text.trim().isEmpty) return '--';
    final trimmed = text.trim();
    return trimmed[0].toUpperCase() + trimmed.substring(1).toLowerCase();
  }

  /// Maps alert severity to corresponding indicator color.
  static Color getSeverityColor(String? severity) {
    switch (severity?.toLowerCase().trim()) {
      case 'critical':
      case 'high':
        return AppConstants.statusCritical;
      case 'warning':
      case 'medium':
      case 'elevated':
        return AppConstants.statusWarning;
      case 'normal':
      case 'low':
        return AppConstants.statusNormal;
      default:
        return AppConstants.statusInactive;
    }
  }

  /// Maps alert severity to an appropriate icon.
  static IconData getSeverityIcon(String? severity) {
    switch (severity?.toLowerCase().trim()) {
      case 'critical':
      case 'high':
        return Icons.error_rounded;
      case 'warning':
      case 'medium':
      case 'elevated':
        return Icons.warning_amber_rounded;
      case 'normal':
      case 'low':
        return Icons.check_circle_rounded;
      default:
        return Icons.info_outline_rounded;
    }
  }

  /// Maps posture / orientation to an appropriate icon.
  static IconData getOrientationIcon(String? orientation) {
    switch (orientation?.toLowerCase().trim()) {
      case 'supine':
        return Icons.hotel_rounded;
      case 'prone':
        return Icons.airline_seat_flat_rounded;
      case 'side':
        return Icons.airline_seat_individual_suite_rounded;
      default:
        return Icons.child_care_rounded;
    }
  }

  static String _monthName(int month) {
    const months = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
    ];
    if (month >= 1 && month <= 12) {
      return months[month - 1];
    }
    return '';
  }
}
