import 'package:flutter/material.dart';
import 'core/theme/app_theme.dart';
import 'services/api_service.dart';
import 'views/login_view.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  final apiService = ApiService();

  runApp(KsqhMetroApp(apiService: apiService));
}

class KsqhMetroApp extends StatelessWidget {
  final ApiService apiService;

  const KsqhMetroApp({Key? key, required this.apiService}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'KSQH Metro 2',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.lightTheme,
      home: LoginView(apiService: apiService),
    );
  }
}
