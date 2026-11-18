import 'package:flutter_test/flutter_test.dart';
import 'package:nicu_mobile/utils/constants.dart';
import 'package:nicu_mobile/utils/formatters.dart';

void main() {
  group('AppFormatters Tests', () {
    test('formatTimestamp formats valid epoch seconds correctly', () {
      // 1794500000 corresponds to a date in 2026
      final formatted = AppFormatters.formatTimestamp(1794500000);
      expect(formatted, contains('2026'));
      expect(formatted, contains('•'));
    });

    test('formatTimestamp handles null and negative values safely', () {
      expect(AppFormatters.formatTimestamp(null), '--:--');
      expect(AppFormatters.formatTimestamp(-1), '--:--');
      expect(AppFormatters.formatTimestamp(0), '--:--');
    });

    test('formatRespirationRate formats values and nulls', () {
      expect(AppFormatters.formatRespirationRate(45), '45 bpm');
      expect(AppFormatters.formatRespirationRate(null), '-- bpm');
    });

    test('formatStressScore formats numeric scale and nulls', () {
      expect(AppFormatters.formatStressScore(25.5), '25.5 / 100');
      expect(AppFormatters.formatStressScore(null), '--');
    });

    test('capitalize transforms strings cleanly', () {
      expect(AppFormatters.capitalize('supine'), 'Supine');
      expect(AppFormatters.capitalize('NORMAL'), 'Normal');
      expect(AppFormatters.capitalize(null), '--');
      expect(AppFormatters.capitalize(''), '--');
    });

    test('getSeverityColor maps severity levels', () {
      expect(AppFormatters.getSeverityColor('normal'), AppConstants.statusNormal);
      expect(AppFormatters.getSeverityColor('warning'), AppConstants.statusWarning);
      expect(AppFormatters.getSeverityColor('critical'), AppConstants.statusCritical);
      expect(AppFormatters.getSeverityColor(null), AppConstants.statusInactive);
    });
  });
}
