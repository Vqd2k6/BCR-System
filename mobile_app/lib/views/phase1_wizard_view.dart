import 'package:flutter/material.dart';
import 'package:latlong2/latlong.dart';
import 'dart:async';
import '../models/phase1_model.dart';
import '../models/user_model.dart';
import '../services/api_service.dart';
import '../services/draft_service.dart';
import '../core/theme/app_theme.dart';
import '../widgets/survey_widgets.dart';
import '../widgets/media_picker_widget.dart';

class Phase1WizardView extends StatefulWidget {
  final String buildingId;
  final String buildingCode;
  final String ownerName;
  final String address;
  final int foundationCat;
  final UserModel user;
  final ApiService apiService;

  const Phase1WizardView({
    Key? key,
    required this.buildingId,
    required this.buildingCode,
    required this.ownerName,
    required this.address,
    required this.foundationCat,
    required this.user,
    required this.apiService,
  }) : super(key: key);

  @override
  State<Phase1WizardView> createState() => _Phase1WizardViewState();
}

class _Phase1WizardViewState extends State<Phase1WizardView>
    with SingleTickerProviderStateMixin {
  int _step = 1;
  final int _totalSteps = 10;
  bool _isSubmitting = false;

  late Phase1Model _model;
  late AnimationController _animCtrl;
  late Animation<double> _fadeAnim;
  Timer? _autoSaveTimer;

  // Options
  final List<String> _scopeOptions = ['Ngoài', 'Trong', 'Mái', 'Hầm', 'Khu phụ', 'Khác'];
  final List<String> _buildingUses = ['RESIDENTIAL', 'COMMERCIAL', 'OFFICE', 'HOTEL', 'PUBLIC', 'OTHER'];
  final List<String> _structuralSystems = ['RC_FRAME', 'STEEL', 'LOAD_BEARING_MASONRY', 'MIXED', 'OTHER'];
  final List<String> _foundationSources = ['DRAWING', 'OWNER_STATEMENT', 'SITE_SURVEY'];

  final List<Map<String, dynamic>> _viCriteria = [
    {
      'key': 'v1', 'label': 'V1 — Công năng / Hậu quả',
      'descriptions': ['Nhà kho', 'Thương mại thông thường', 'Văn phòng / Nhà ở', 'Cơ sở đặc biệt (BV, Trường)'],
    },
    {
      'key': 'v2', 'label': 'V2 — Hệ kết cấu / Dễ hư hỏng',
      'descriptions': ['Khung BTCT sàn 2 phương', 'Khung BTCT sàn 1 phương', 'Tường chịu lực', 'Kết cấu yếu/cũ'],
    },
    {
      'key': 'v4', 'label': 'V4 — Tuổi đời / Cơi nới',
      'descriptions': ['<20 năm, không cơi nới', '20-40 năm, cơi nới nhỏ', '40-60 năm / cơi nới đáng kể', '>60 năm / cơi nới nhiều lần'],
    },
    {
      'key': 'v6', 'label': 'V6 — Thiết bị nhạy cảm',
      'descriptions': ['Không có', 'Ít nhạy cảm', 'Nhạy cảm (Server)', 'Cực nhạy (MRI, Phòng sạch)'],
    },
  ];

  @override
  void initState() {
    super.initState();
    _model = Phase1Model(buildingId: widget.buildingId, foundationCat: widget.foundationCat);
    _animCtrl = AnimationController(vsync: this, duration: const Duration(milliseconds: 300));
    _fadeAnim = CurvedAnimation(parent: _animCtrl, curve: Curves.easeInOut);
    _animCtrl.forward();
    
    _loadDraft();
    _autoSaveTimer = Timer.periodic(const Duration(seconds: 3), (timer) {
      if (!_isSubmitting) DraftService.savePhase1Draft(widget.buildingId, _model.toJson());
    });
  }

  Future<void> _loadDraft() async {
    final draft = await DraftService.loadPhase1Draft(widget.buildingId);
    if (draft != null && mounted) {
      setState(() => _model = Phase1Model.fromJson(draft));
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Đã khôi phục bản nháp')));
    }
  }

  @override
  void dispose() {
    _autoSaveTimer?.cancel();
    _animCtrl.dispose();
    super.dispose();
  }

  void _goNext() {
    if (_step < _totalSteps) {
      _animCtrl.reverse().then((_) {
        setState(() => _step++);
        _animCtrl.forward();
      });
    }
  }

  void _goPrev() {
    if (_step > 1) {
      _animCtrl.reverse().then((_) {
        setState(() => _step--);
        _animCtrl.forward();
      });
    }
  }

  Future<void> _submitPhase1() async {
    setState(() => _isSubmitting = true);
    try {
      await widget.apiService.submitPhase1(
        buildingId: widget.buildingId,
        payload: _model.toJson(),
      );
      await DraftService.clearPhase1Draft(widget.buildingId);
      
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('✅ Đã nộp Hồ sơ Phase 1 thành công!'), backgroundColor: AppTheme.success),
        );
        Navigator.pop(context, true);
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Nộp thất bại (đã lưu Offline Queue): $e'), backgroundColor: Colors.orange),
        );
        Navigator.pop(context, true);
      }
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.background,
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Phase 1: BCS-ECS-BRA', style: TextStyle(fontSize: 16)),
            Text('${widget.buildingCode} - Bước $_step/$_totalSteps', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.normal)),
          ],
        ),
      ),
      body: SafeArea(
        child: Column(
          children: [
            // Progress Bar
            LinearProgressIndicator(
              value: _step / _totalSteps,
              backgroundColor: Colors.grey[300],
              valueColor: const AlwaysStoppedAnimation<Color>(AppTheme.primary),
            ),
            Expanded(
              child: FadeTransition(
                opacity: _fadeAnim,
                child: SingleChildScrollView(
                  padding: const EdgeInsets.all(16),
                  child: _buildCurrentStep(),
                ),
              ),
            ),
            _buildBottomNav(),
          ],
        ),
      ),
    );
  }

  Widget _buildCurrentStep() {
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
  }

  // =========================================================================
  // STEPS UI
  // =========================================================================

  Widget _buildStep1Info() {
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

  Widget _buildStep1Scope() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('3. Phạm vi khảo sát', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
        const SizedBox(height: 16),
        const Text('Phạm vi đã khảo sát:', style: TextStyle(fontWeight: FontWeight.bold)),
        Wrap(
          spacing: 8,
          children: _scopeOptions.map((scope) {
            final isSelected = _model.surveyedScope.contains(scope);
            return FilterChip(
              label: Text(scope),
              selected: isSelected,
              onSelected: (val) {
                setState(() {
                  if (val) _model.surveyedScope.add(scope);
                  else _model.surveyedScope.remove(scope);
                });
              },
            );
          }).toList(),
        ),
        const SizedBox(height: 16),
        SwitchListTile(
          title: const Text('Có giới hạn tiếp cận?'),
          value: _model.hasAccessRestriction,
          onChanged: (v) => setState(() => _model.hasAccessRestriction = v),
          contentPadding: EdgeInsets.zero,
        ),
        if (_model.hasAccessRestriction)
          TextField(
            decoration: const InputDecoration(labelText: 'Ghi chú giới hạn', border: OutlineInputBorder()),
            onChanged: (v) => _model.accessRestrictionNotes = v,
            controller: TextEditingController(text: _model.accessRestrictionNotes)..selection = TextSelection.collapsed(offset: _model.accessRestrictionNotes.length),
          ),
      ],
    );
  }

  Widget _buildStep2Features() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('4. Đặc điểm & Móng', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
        const SizedBox(height: 16),
        DropdownButtonFormField<String>(
          value: _model.buildingUse,
          decoration: const InputDecoration(labelText: 'Mục đích sử dụng', border: OutlineInputBorder()),
          items: _buildingUses.map((e) => DropdownMenuItem(value: e, child: Text(e))).toList(),
          onChanged: (v) => setState(() => _model.buildingUse = v!),
        ),
        const SizedBox(height: 16),
        DropdownButtonFormField<String>(
          value: _model.structuralSystem,
          decoration: const InputDecoration(labelText: 'Hệ kết cấu', border: OutlineInputBorder()),
          items: _structuralSystems.map((e) => DropdownMenuItem(value: e, child: Text(e))).toList(),
          onChanged: (v) => setState(() => _model.structuralSystem = v!),
        ),
        const SizedBox(height: 16),
        Row(
          children: [
            Expanded(
              child: DropdownButtonFormField<int>(
                value: _model.foundationCat,
                decoration: const InputDecoration(labelText: 'CAT Móng', border: OutlineInputBorder()),
                items: [1,2,3,4,5].map((e) => DropdownMenuItem(value: e, child: Text('CAT $e'))).toList(),
                onChanged: (v) => setState(() => _model.foundationCat = v!),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: DropdownButtonFormField<String>(
                value: _model.foundationSource,
                decoration: const InputDecoration(labelText: 'Nguồn thông tin', border: OutlineInputBorder()),
                items: _foundationSources.map((e) => DropdownMenuItem(value: e, child: Text(e))).toList(),
                onChanged: (v) => setState(() => _model.foundationSource = v!),
              ),
            ),
          ],
        )
      ],
    );
  }

  Widget _buildStep3History() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('5. Lịch sử & Nhạy cảm', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
        const SizedBox(height: 16),
        SwitchListTile(title: const Text('Cơi nới / Thay đổi tải trọng'), value: _model.hasExtensionsLoadChange, onChanged: (v) => setState(() => _model.hasExtensionsLoadChange = v)),
        SwitchListTile(title: const Text('Sửa chữa lớn'), value: _model.hasMajorRepairs, onChanged: (v) => setState(() => _model.hasMajorRepairs = v)),
        SwitchListTile(title: const Text('Lún/Nghiêng từ trước'), value: _model.hasPriorSettlementTilt, onChanged: (v) => setState(() => _model.hasPriorSettlementTilt = v)),
        SwitchListTile(title: const Text('Hư hỏng do CT lân cận'), value: _model.hasAdjacentConstructionDamage, onChanged: (v) => setState(() => _model.hasAdjacentConstructionDamage = v)),
        SwitchListTile(title: const Text('Thiết bị nhạy cảm'), value: _model.hasSensitiveEquipment, onChanged: (v) => setState(() => _model.hasSensitiveEquipment = v)),
        if (_model.hasSensitiveEquipment)
          TextField(
            decoration: const InputDecoration(labelText: 'Ghi chú thiết bị', border: OutlineInputBorder()),
            onChanged: (v) => _model.sensitiveEquipmentNotes = v,
            controller: TextEditingController(text: _model.sensitiveEquipmentNotes)..selection = TextSelection.collapsed(offset: _model.sensitiveEquipmentNotes.length),
          ),
      ],
    );
  }

  Widget _buildStep4Burland() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('6. Thang đo hư hỏng Burland', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
        const SizedBox(height: 16),
        DropdownButtonFormField<StructuralFlag>(
          value: _model.structuralFlag,
          decoration: const InputDecoration(labelText: 'Cờ khuyết tật kết cấu', border: OutlineInputBorder()),
          items: StructuralFlag.values.map((e) => DropdownMenuItem(value: e, child: Text(e.name.toUpperCase()))).toList(),
          onChanged: (v) => setState(() => _model.structuralFlag = v!),
        ),
        const SizedBox(height: 16),
        Row(
          children: [
            Expanded(child: _buildNumberInput('Burland Predominant (0-5)', _model.burlandPredominant, (v) => setState(() => _model.burlandPredominant = v))),
            const SizedBox(width: 12),
            Expanded(child: _buildNumberInput('Burland Local Max (0-5)', _model.burlandLocalMax, (v) => setState(() => _model.burlandLocalMax = v))),
          ],
        ),
        const SizedBox(height: 16),
        const Text('Phân vùng hư hỏng (Z01-Z05)', style: TextStyle(fontWeight: FontWeight.bold)),
        const SizedBox(height: 8),
        ..._model.burlandZones.map((z) => Card(
          elevation: 1,
          margin: const EdgeInsets.only(bottom: 8),
          child: Padding(
            padding: const EdgeInsets.all(8.0),
            child: Column(
              children: [
                Row(
                  children: [
                    Text(z.zoneId, style: const TextStyle(fontWeight: FontWeight.bold, color: AppTheme.primary)),
                    const SizedBox(width: 8),
                    Expanded(child: _buildTextInput('Vị trí', z.location, (v) => z.location = v)),
                  ],
                ),
                Row(
                  children: [
                    Expanded(child: _buildNumberInputDouble('wmax (mm)', z.wmax, (v) => z.wmax = v)),
                    const SizedBox(width: 8),
                    Expanded(child: _buildNumberInput('Grade', z.grade, (v) => z.grade = v)),
                  ],
                )
              ],
            ),
          ),
        )).toList(),
      ],
    );
  }

  Widget _buildStep5Ecs() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('7. ECS – Đánh giá tình trạng hiện hữu', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
        const SizedBox(height: 16),
        _buildEcsSlider('E1. Hư hỏng nhìn thấy (Tường)', _model.e1StructuralCracks, (v) => setState(() => _model.e1StructuralCracks = v.toInt())),
        _buildEcsSlider('E2. Khuyết tật kết cấu chịu lực', _model.e2WallMasonryCracks, (v) => setState(() => _model.e2WallMasonryCracks = v.toInt())),
        _buildEcsSlider('E3. Lún / Nghiêng / Võng', _model.e3DeformationTilt, (v) => setState(() => _model.e3DeformationTilt = v.toInt())),
        _buildEcsSlider('E4. Suy giảm vật liệu (Thấm, rỉ)', _model.e4WaterSeepageDet, (v) => setState(() => _model.e4WaterSeepageDet = v.toInt())),
        _buildEcsSlider('E5. Lịch sử / Cơi nới / Toàn vẹn', _model.e5HistoryIntegrity, (v) => setState(() => _model.e5HistoryIntegrity = v.toInt())),
        _buildEcsSlider('E6. Tình trạng chức năng', _model.e6FunctionalityState, (v) => setState(() => _model.e6FunctionalityState = v.toInt())),
        const Divider(height: 32, thickness: 2),
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(color: Colors.blue.withOpacity(0.1), borderRadius: BorderRadius.circular(8)),
          child: Column(
            children: [
              Text('TỔNG ECS: ${_model.ecsTotal} / 24', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
              Text('XẾP LOẠI: ${_model.computedEcsClass.label}', style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold, color: _getEcsColor(_model.computedEcsClass))),
            ],
          ),
        )
      ],
    );
  }

  Widget _buildStep6DataAndVi() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('8. Dữ liệu & Chỉ số VI', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
        const SizedBox(height: 16),
        const Text('Data Completeness Gate', style: TextStyle(fontWeight: FontWeight.bold)),
        Wrap(
          children: [
            _buildCheck('Đủ móng', _model.gateFoundation, (v) => setState(()=> _model.gateFoundation = v)),
            _buildCheck('Đủ ảnh', _model.gatePhotos, (v) => setState(()=> _model.gatePhotos = v)),
            _buildCheck('Khảo sát trong', _model.gateInternalSurvey, (v) => setState(()=> _model.gateInternalSurvey = v)),
            _buildCheck('Bản vẽ', _model.gateDrawings, (v) => setState(()=> _model.gateDrawings = v)),
          ],
        ),
        const Divider(height: 32),
        const Text('Chỉ số dễ tổn thương (VI)', style: TextStyle(fontWeight: FontWeight.bold)),
        _buildViSlider('V1. Công năng (1-4)', _model.v1UseConsequence, (v) => setState(()=> _model.v1UseConsequence = v.toInt())),
        _buildViSlider('V2. Kết cấu (1-4)', _model.v2StructuralFragility, (v) => setState(()=> _model.v2StructuralFragility = v.toInt())),
        _buildViSlider('V4. Tuổi đời/Cơi nới (1-4)', _model.v4AgeModifications, (v) => setState(()=> _model.v4AgeModifications = v.toInt())),
        _buildViSlider('V6. Thiết bị nhạy cảm (1-4)', _model.v6SensitiveEquipment, (v) => setState(()=> _model.v6SensitiveEquipment = v.toInt())),
        Container(
          padding: const EdgeInsets.all(12),
          color: Colors.grey[200],
          child: Column(
            children: [
              Text('V3 (từ Móng): ${_model.v3FoundationMapped} | V5 (từ ECS): ${_model.v5EcsMapped}'),
              Text('VI Average: ${_model.viAverage.toStringAsFixed(2)} => ${_model.computedViClass.label}', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
            ],
          ),
        )
      ],
    );
  }

  Widget _buildStep7Impact() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('9. Tác động từ Metro', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
        const SizedBox(height: 16),
        DropdownButtonFormField<ImpactClass>(
          value: _model.impactClass,
          decoration: const InputDecoration(labelText: 'Construction Impact Class (I)', border: OutlineInputBorder()),
          items: ImpactClass.values.map((e) => DropdownMenuItem(value: e, child: Text(e.name.toUpperCase()))).toList(),
          onChanged: (v) => setState(() => _model.impactClass = v!),
        ),
        const SizedBox(height: 16),
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(color: Colors.red.withOpacity(0.1), borderRadius: BorderRadius.circular(8), border: Border.all(color: Colors.red)),
          child: Column(
            children: [
              const Text('KẾT QUẢ BRA', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
              const SizedBox(height: 8),
              Text(_model.computedBraResult.label, style: const TextStyle(fontSize: 26, fontWeight: FontWeight.bold, color: Colors.red)),
              const SizedBox(height: 8),
              Text(_getBraRecommendation(_model.computedBraResult), textAlign: TextAlign.center),
            ],
          ),
        )
      ],
    );
  }

  Widget _buildStep8Summary() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const Icon(Icons.check_circle_outline, size: 80, color: AppTheme.success),
        const SizedBox(height: 16),
        const Text('Hoàn tất Khảo sát Phase 1', textAlign: TextAlign.center, style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold)),
        const SizedBox(height: 24),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16.0),
            child: Column(
              children: [
                _summaryRow('Tổng điểm ECS:', '${_model.ecsTotal} (${_model.computedEcsClass.label})'),
                _summaryRow('Điểm VI TB:', '${_model.viAverage.toStringAsFixed(2)} (${_model.computedViClass.label})'),
                _summaryRow('Cấp tác động (I):', _model.impactClass.name.toUpperCase()),
                const Divider(),
                _summaryRow('Rủi ro BRA:', _model.computedBraResult.label),
              ],
            ),
          ),
        ),
      ],
    );
  }

  // =========================================================================
  // HELPER WIDGETS
  // =========================================================================

  Widget _buildBottomNav() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(color: Colors.white, boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.05), blurRadius: 10, offset: const Offset(0, -5))]),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          if (_step > 1) OutlinedButton(onPressed: _goPrev, child: const Text('Quay lại')) else const SizedBox(width: 80),
          if (_step < _totalSteps)
            ElevatedButton(onPressed: _goNext, child: const Text('Tiếp tục'))
          else
            ElevatedButton(
              onPressed: _isSubmitting ? null : _submitPhase1,
              style: ElevatedButton.styleFrom(backgroundColor: AppTheme.success),
              child: _isSubmitting ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2)) : const Text('Hoàn tất & Ký'),
            ),
        ],
      ),
    );
  }

  Widget _buildNumberInput(String label, int value, Function(int) onChanged) {
    return TextFormField(
      initialValue: value.toString(),
      keyboardType: TextInputType.number,
      decoration: InputDecoration(labelText: label, border: const OutlineInputBorder()),
      onChanged: (v) => onChanged(int.tryParse(v) ?? 0),
    );
  }
  
  Widget _buildNumberInputDouble(String label, double value, Function(double) onChanged) {
    return TextFormField(
      initialValue: value.toString(),
      keyboardType: const TextInputType.numberWithOptions(decimal: true),
      decoration: InputDecoration(labelText: label, border: const OutlineInputBorder()),
      onChanged: (v) => onChanged(double.tryParse(v) ?? 0.0),
    );
  }

  Widget _buildTextInput(String label, String value, Function(String) onChanged) {
    return TextFormField(
      initialValue: value,
      decoration: InputDecoration(labelText: label, border: const OutlineInputBorder()),
      onChanged: onChanged,
    );
  }

  Widget _buildEcsSlider(String title, int value, Function(double) onChanged) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(title, style: const TextStyle(fontWeight: FontWeight.bold)),
        Slider(value: value.toDouble(), min: 0, max: 4, divisions: 4, label: value.toString(), onChanged: onChanged),
      ],
    );
  }

  Widget _buildViSlider(String title, int value, Function(double) onChanged) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(title, style: const TextStyle(fontWeight: FontWeight.bold)),
        Slider(value: value.toDouble(), min: 1, max: 4, divisions: 3, label: value.toString(), onChanged: onChanged),
      ],
    );
  }

  Widget _buildCheck(String label, bool value, Function(bool) onChanged) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Checkbox(value: value, onChanged: (v) => onChanged(v!)),
        Text(label),
      ],
    );
  }

  Widget _summaryRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [Text(label), Text(value, style: const TextStyle(fontWeight: FontWeight.bold))]),
    );
  }

  Color _getEcsColor(EcsClass e) {
    switch (e) {
      case EcsClass.good: return Colors.green;
      case EcsClass.medium: return Colors.orange;
      case EcsClass.deficient: return Colors.deepOrange;
      case EcsClass.critical: return Colors.red;
    }
  }

  String _getBraRecommendation(BraResult r) {
    switch (r) {
      case BraResult.low: return 'Lưu hồ sơ nền, quan trắc theo kế hoạch định kỳ.';
      case BraResult.medium: return 'Thiết lập đầy đủ mốc BCS và quan trắc chuyển vị.';
      case BraResult.high: return 'Khảo sát kết cấu & móng chi tiết trước khi thi công.';
      case BraResult.veryHigh: return '⚠️ Đánh giá chuyên sâu bắt buộc — Hold Point thi công.';
      case BraResult.pending: return 'Chưa có dữ liệu dự báo tác động thi công.';
    }
  }
}
