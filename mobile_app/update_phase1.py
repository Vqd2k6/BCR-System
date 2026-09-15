import re

with open("lib/views/phase1_wizard_view.dart", "r") as f:
    content = f.read()

# Change totalSteps = 8 to 10
content = content.replace("int _totalSteps = 8;", "int _totalSteps = 10;")

# Import MediaPickerWidget
content = content.replace("import '../widgets/survey_widgets.dart';", "import '../widgets/survey_widgets.dart';\nimport '../widgets/media_picker_widget.dart';")

# Update _buildCurrentStep
old_build_step = """  Widget _buildCurrentStep() {
    switch (_step) {
      case 1: return _buildStep1Scope();
      case 2: return _buildStep2Features();
      case 3: return _buildStep3History();
      case 4: return _buildStep4Burland();
      case 5: return _buildStep5Ecs();
      case 6: return _buildStep6DataAndVi();
      case 7: return _buildStep7Impact();
      case 8: return _buildStep8Summary();
      default: return const SizedBox();
    }
  }"""

new_build_step = """  Widget _buildCurrentStep() {
    switch (_step) {
      case 1: return _buildStep1Info();
      case 2: return _buildStep2Media();
      case 3: return _buildStep1Scope();
      case 4: return _buildStep2Features();
      case 5: return _buildStep3History();
      case 6: return _buildStep4Burland();
      case 7: return _buildStep5Ecs();
      case 8: return _buildStep6DataAndVi();
      case 9: return _buildStep7Impact();
      case 10: return _buildStep8Summary();
      default: return const SizedBox();
    }
  }"""

content = content.replace(old_build_step, new_build_step)

# Add _buildStep1Info and _buildStep2Media
new_steps = """  Widget _buildStep1Info() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('1. Thông tin công trình', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
        const SizedBox(height: 16),
        TextField(
          decoration: const InputDecoration(labelText: 'Tên chủ hộ / Đại diện', border: OutlineInputBorder()),
          onChanged: (v) => _model.ownerName = v,
          controller: TextEditingController(text: _model.ownerName)..selection = TextSelection.collapsed(offset: _model.ownerName.length),
        ),
        const SizedBox(height: 16),
        TextField(
          decoration: const InputDecoration(labelText: 'Địa chỉ thực tế', border: OutlineInputBorder()),
          onChanged: (v) => _model.address = v,
          controller: TextEditingController(text: _model.address)..selection = TextSelection.collapsed(offset: _model.address.length),
        ),
        const SizedBox(height: 16),
        TextField(
          decoration: const InputDecoration(labelText: 'Năm xây dựng', border: OutlineInputBorder()),
          keyboardType: TextInputType.number,
          onChanged: (v) => _model.constructionYear = int.tryParse(v),
          controller: TextEditingController(text: _model.constructionYear?.toString() ?? '')..selection = TextSelection.collapsed(offset: _model.constructionYear?.toString().length ?? 0),
        ),
      ],
    );
  }

  Widget _buildStep2Media() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('2. Ảnh định danh hiện trường', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
        const SizedBox(height: 16),
        MediaPickerWidget(
          label: 'P-01 (Biển số / Biển tên)',
          watermarkText: '${widget.buildingCode}-P01 - GPS: 10.762, 106.660',
          onImageSelected: (bytes, filename) {
            _model.photoP01Url = filename;
          },
        ),
        MediaPickerWidget(
          label: 'P-02 (Mặt đứng chính)',
          watermarkText: '${widget.buildingCode}-P02 - GPS: 10.762, 106.660',
          onImageSelected: (bytes, filename) {
            _model.photoP02Url = filename;
          },
        ),
        MediaPickerWidget(
          label: 'P-03 (Bên/sau - Tùy chọn)',
          watermarkText: '${widget.buildingCode}-P03 - GPS: 10.762, 106.660',
          onImageSelected: (bytes, filename) {
            _model.photoP03Url = filename;
          },
        ),
        MediaPickerWidget(
          label: 'P-04 (Bối cảnh tổng thể)',
          watermarkText: '${widget.buildingCode}-P04 - GPS: 10.762, 106.660',
          onImageSelected: (bytes, filename) {
            _model.photoP04Url = filename;
          },
        ),
      ],
    );
  }

  Widget _buildStep1Scope() {"""

content = content.replace("  Widget _buildStep1Scope() {", new_steps)

# Change Text of Scope to 3
content = content.replace("const Text('1. Thông tin chung & Phạm vi khảo sát'", "const Text('3. Phạm vi khảo sát'")
content = content.replace("const Text('2. Đặc điểm & Móng'", "const Text('4. Đặc điểm & Móng'")
content = content.replace("const Text('3. Lịch sử & Nhạy cảm'", "const Text('5. Lịch sử & Nhạy cảm'")
content = content.replace("const Text('4. Thang đo hư hỏng Burland'", "const Text('6. Thang đo hư hỏng Burland'")
content = content.replace("const Text('5. Điểm hiện trạng (ECS)'", "const Text('7. Điểm hiện trạng (ECS)'")
content = content.replace("const Text('6. Dữ liệu & Chỉ số VI'", "const Text('8. Dữ liệu & Chỉ số VI'")
content = content.replace("const Text('7. Tác động từ Metro'", "const Text('9. Tác động từ Metro'")
content = content.replace("const Text('8. Tổng hợp & Kết luận (BRA)'", "const Text('10. Tổng hợp & Kết luận (BRA)'")

with open("lib/views/phase1_wizard_view.dart", "w") as f:
    f.write(content)
