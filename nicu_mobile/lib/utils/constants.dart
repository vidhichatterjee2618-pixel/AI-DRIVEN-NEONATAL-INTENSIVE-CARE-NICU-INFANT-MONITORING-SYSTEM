import 'package:material_ui/material_ui.dart';

/// Application-wide constants for the NICU Infant Monitoring System.
/// 
/// Academic Proof-of-Concept for College PBL Project.
/// NOT a clinically validated medical device.
class AppConstants {
  // App Identifiers & Titles
  static const String appTitle = 'NICU Monitor';
  static const String dashboardTitle = 'Live Infant Monitoring';
  static const String academicDisclaimer =
      'Academic Proof-of-Concept • College PBL Project\nNot a Clinically Validated Medical Device';
  static const String demoDataLabel = 'DEMO / SIMULATED DATA';

  // Academic Reference Ranges (for UI visualization purposes only)
  // Standard pediatric literature reference: Normal resting neonatal respiration rate: 30-60 bpm
  static const num normalMinRespirationRate = 30;
  static const num normalMaxRespirationRate = 60;
  
  // Stress Score Scale (0-100 reference scale from backend respiration/motion analysis)
  static const num normalMaxStressScore = 30.0;
  static const num elevatedStressScore = 60.0;

  // Severity labels
  static const String severityNormal = 'normal';
  static const String severityWarning = 'warning';
  static const String severityCritical = 'critical';

  // Primary Theme Colors (Medical Blue & Soft Accents)
  static const Color primaryBlue = Color(0xFF0D47A1);      // Deep medical blue
  static const Color primaryLight = Color(0xFF1976D2);     // Medium blue
  static const Color accentTeal = Color(0xFF00897B);       // Vitality teal
  static const Color backgroundLight = Color(0xFFF5F7FB);  // Soft sterile grey-blue
  static const Color cardBackground = Colors.white;

  // Status & Alert Indicator Colors
  static const Color statusNormal = Color(0xFF2E7D32);     // Medical Green
  static const Color statusWarning = Color(0xFFED6C02);    // Amber Warning
  static const Color statusCritical = Color(0xFFD32F2F);   // Alert Red
  static const Color statusInactive = Color(0xFF757575);   // Neutral Grey
}
