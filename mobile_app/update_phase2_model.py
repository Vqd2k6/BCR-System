import re

with open("lib/models/phase2_model.dart", "r") as f:
    content = f.read()

enum_def = """
enum AccessStatus {
  full('Đầy đủ'),
  partial('Một phần'),
  restricted('Bị hạn chế'),
  denied('Từ chối/Vắng mặt');

  final String label;
  const AccessStatus(this.label);
}
"""

if "enum AccessStatus" not in content:
    content = content.replace("enum DeltaComparison", enum_def + "\nenum DeltaComparison")

# Add accessStatus to Phase2Model
if "AccessStatus accessStatus" not in content:
    content = content.replace("String mostNotableDamage;", "String mostNotableDamage;\n  AccessStatus accessStatus;")
    content = content.replace("this.mostNotableDamage = '',", "this.mostNotableDamage = '',\n    this.accessStatus = AccessStatus.full,")
    content = content.replace("'mostNotableDamage': mostNotableDamage,", "'mostNotableDamage': mostNotableDamage,\n    'accessStatus': accessStatus.name,")
    content = content.replace("mostNotableDamage: json['mostNotableDamage'] ?? '',", "mostNotableDamage: json['mostNotableDamage'] ?? '',\n      accessStatus: AccessStatus.values.firstWhere((e) => e.name == json['accessStatus'], orElse: () => AccessStatus.full),")

with open("lib/models/phase2_model.dart", "w") as f:
    f.write(content)
