class UserModel {
  final String id;
  final String username;
  final String fullName;
  final String role;
  final String employeeCode;
  final String token;

  UserModel({
    required this.id,
    required this.username,
    required this.fullName,
    required this.role,
    required this.employeeCode,
    required this.token,
  });

  factory UserModel.fromJson(Map<String, dynamic> json, String token) {
    return UserModel(
      id: json['id'] ?? '',
      username: json['username'] ?? '',
      fullName: json['fullName'] ?? '',
      role: json['role'] ?? 'FIELD_SURVEYOR',
      employeeCode: json['employeeCode'] ?? '',
      token: token,
    );
  }
}
