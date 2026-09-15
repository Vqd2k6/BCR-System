import 'dart:async';
import 'package:flutter/material.dart';
import '../models/phase2_model.dart';
import '../models/user_model.dart';
import '../services/api_service.dart';
import '../services/draft_service.dart';
import '../core/theme/app_theme.dart';
import '../widgets/survey_widgets.dart';
import '../widgets/media_picker_widget.dart';
import '../widgets/defect_pinning_widget.dart';

class Phase2WizardView extends StatefulWidget {
  final String buildingId;
  final String buildingCode;
  final String ownerName;
  final String address;
  final String phase1Id;
  final String phase1EcsClass;
  final String phase1BraResult;
  final UserModel user;
  final ApiService apiService;

  const Phase2WizardView({
    Key? key,
    required this.buildingId,
    required this.buildingCode,
    required this.ownerName,
    required this.address,
    required this.phase1Id,
    required this.phase1EcsClass,
    required this.phase1BraResult,
    required this.user,
    required this.apiService,
  }) : super(key: key);

  @override
  State<Phase2WizardView> createState() => _Phase2WizardViewState();
}

class _Phase2WizardViewState extends State<Phase2WizardView>
    with SingleTickerProviderStateMixin {
  int _step = 1;
  final int _totalSteps = 7; // 7 Bước chuẩn hóa Docx
  bool _isSubmitting = false;

  late Phase2Model _model;
  late AnimationController _animCtrl;
  late Animation<double> _fadeAnim;
  Timer? _autoSaveTimer;

  @override
  void initState() {
    super.initState();
    _model = Phase2Model(buildingId: widget.buildingId, phase1Id: widget.phase1Id);
    _animCtrl = AnimationController(vsync: this, duration: const Duration(milliseconds: 300));
    _fadeAnim = CurvedAnimation(parent: _animCtrl, curve: Curves.easeInOut);
    _animCtrl.forward();
    
    _loadDraft();
    _autoSaveTimer = Timer.periodic(const Duration(seconds: 3), (timer) {
      if (!_isSubmitting) DraftService.savePhase2Draft(widget.buildingId, _model.toJson());
    });
  }

  Future<void> _loadDraft() async {
    final draft = await DraftService.loadPhase2Draft(widget.buildingId);
    if (draft != null && mounted) {
      setState(() => _model = Phase2Model.fromJson(draft));
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

  Future<void> _submitPhase2() async {
    setState(() => _isSubmitting = true);
    try {
      await widget.apiService.submitPhase2(buildingId: widget.buildingId, payload: _model.toJson());
      await DraftService.clearPhase2Draft(widget.buildingId);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('✅ Đã nộp Hồ sơ Phase 2!'), backgroundColor: AppTheme.success));
        Navigator.pop(context, true);
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Nộp thất bại (lưu Offline): $e'), backgroundColor: Colors.orange));
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
            const Text('Phase 2: Pre-Construction', style: TextStyle(fontSize: 16)),
            Text('${widget.buildingCode} - Bước $_step/$_totalSteps', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.normal)),
          ],
        ),
      ),
      body: SafeArea(
        child: Column(
          children: [
            LinearProgressIndicator(
              value: _step / _totalSteps,
              backgroundColor: Colors.grey[300],
              valueColor: const AlwaysStoppedAnimation<Color>(AppTheme.secondary),
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
      case 1: return _buildStep1Changes();
      case 2: return _buildStep2Scope();
      case 3: return _buildStep3RoomGrid();
      case 4: return _buildStep4Defects();
      case 5: return _buildStep5Tilt();
      case 6: return _buildStep6Sketch();
      case 7: return _buildStep7Summary();
      default: return const SizedBox();
    }
  }

  // =========================================================================
  // STEPS UI
  // =========================================================================

  Widget _buildStep1Changes() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('1. Thay đổi so với GĐ1', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
        const SizedBox(height: 16),
        Container(
          padding: const EdgeInsets.all(12),
          color: Colors.blue.withOpacity(0.1),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Kế thừa Phase 1: ${widget.phase1Id.substring(0, 8)}...'),
              Text('ECS GĐ1: ${widget.phase1EcsClass}'),
              Text('BRA GĐ1: ${widget.phase1BraResult}'),
            ],
          ),
        ),
        const SizedBox(height: 16),
        SwitchListTile(title: const Text('Có cơi nới/cải tạo?'), value: _model.hasExtensions, onChanged: (v) => setState(() => _model.hasExtensions = v)),
        if (_model.hasExtensions) _buildTextInput('Chi tiết cơi nới', _model.extensionsNotes, (v) => _model.extensionsNotes = v),
        SwitchListTile(title: const Text('Có sửa chữa hư hỏng?'), value: _model.hasRepairs, onChanged: (v) => setState(() => _model.hasRepairs = v)),
        if (_model.hasRepairs) _buildTextInput('Chi tiết sửa chữa', _model.repairsNotes, (v) => _model.repairsNotes = v),
        SwitchListTile(title: const Text('Thay đổi tải trọng/công năng?'), value: _model.hasLoadChanges, onChanged: (v) => setState(() => _model.hasLoadChanges = v)),
        if (_model.hasLoadChanges) _buildTextInput('Chi tiết tải trọng', _model.loadChangesNotes, (v) => _model.loadChangesNotes = v),
        const Divider(),
        SwitchListTile(title: const Text('KHÔNG có thay đổi đáng kể', style: TextStyle(fontWeight: FontWeight.bold)), value: _model.noSignificantChangeFromPhase1, onChanged: (v) => setState(() => _model.noSignificantChangeFromPhase1 = v)),
      ],
    );
  }

  Widget _buildStep2Scope() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('2. Phạm vi tiếp cận chi tiết', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
        const SizedBox(height: 16),
        DropdownButtonFormField<AccessStatus>(
          value: _model.accessStatus,
          decoration: const InputDecoration(labelText: 'Mức độ tiếp cận', border: OutlineInputBorder()),
          items: AccessStatus.values.map((e) => DropdownMenuItem(value: e, child: Text(e.label))).toList(),
          onChanged: (v) => setState(() => _model.accessStatus = v!),
        ),
        const SizedBox(height: 16),
        MediaPickerWidget(
          label: 'Chụp ảnh P01 (Số nhà + Mặt đứng)',
          watermarkText: '${widget.buildingCode}-P01 - GPS: 10.762, 106.660',
          onImageSelected: (bytes, filename) => setState(() => _model.p01PhotoUrl = filename),
        ),
        const SizedBox(height: 16),
        MediaPickerWidget(
          label: 'Chụp ảnh P02 (Toàn cảnh đường/tuyến)',
          watermarkText: '${widget.buildingCode}-P02 - GPS: 10.762, 106.660',
          onImageSelected: (bytes, filename) => setState(() => _model.p02PhotoUrl = filename),
        ),
        const SizedBox(height: 16),
        const Text('Lưu ý: Ảnh bắt buộc phải tự động gắn watermark Tọa độ GPS & Thời gian thực.', style: TextStyle(fontStyle: FontStyle.italic, color: Colors.grey)),
      ],
    );
  }

  Widget _buildStep3RoomGrid() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('3. Lưới Ghi nhận Hiện trạng (Phòng/Tầng)', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
        const SizedBox(height: 16),
        ..._model.roomAssessments.asMap().entries.map((e) => _buildRoomCard(e.key, e.value)).toList(),
        const SizedBox(height: 16),
        ElevatedButton.icon(
          onPressed: () {
            setState(() {
              _model.roomAssessments.add(RoomAssessment(floorOrZone: 'Tầng ${_model.roomAssessments.length + 1}'));
            });
          },
          icon: const Icon(Icons.add),
          label: const Text('Thêm Khu vực/Tầng'),
        )
      ],
    );
  }

  Widget _buildRoomCard(int index, RoomAssessment room) {
    return Card(
      elevation: 2,
      margin: const EdgeInsets.only(bottom: 12),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          children: [
            Row(
              children: [
                Expanded(child: _buildTextInput('Khu vực/Tầng', room.floorOrZone, (v) => room.floorOrZone = v)),
                IconButton(icon: const Icon(Icons.delete, color: Colors.red), onPressed: () => setState(() => _model.roomAssessments.removeAt(index))),
              ],
            ),
            const SizedBox(height: 8),
            _buildTextInput('Sàn/Trần', room.slabCeilingState, (v) => room.slabCeilingState = v),
            const SizedBox(height: 8),
            _buildTextInput('Tường', room.wallState, (v) => room.wallState = v),
            const SizedBox(height: 8),
            _buildTextInput('Cột/Dầm', room.columnBeamState, (v) => room.columnBeamState = v),
            const SizedBox(height: 8),
            _buildTextInput('Thấm/Bong tróc', room.seepageSpallingState, (v) => room.seepageSpallingState = v),
            const SizedBox(height: 8),
            _buildTextInput('Lún/Nghiêng/Biến dạng', room.settlementDeformationState, (v) => room.settlementDeformationState = v),
          ],
        ),
      ),
    );
  }

  Widget _buildStep4Defects() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('4. Sổ Khuyết Tật (Defect Register)', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
        const SizedBox(height: 16),
        ..._model.defects.asMap().entries.map((e) => _buildDefectCard(e.key, e.value)).toList(),
        const SizedBox(height: 16),
        ElevatedButton.icon(
          onPressed: _addNewDefect,
          icon: const Icon(Icons.add_box),
          label: const Text('Ghi nhận Khuyết tật mới'),
          style: ElevatedButton.styleFrom(backgroundColor: AppTheme.secondary, foregroundColor: Colors.white),
        )
      ],
    );
  }

  void _addNewDefect() {
    setState(() {
      _model.defects.add(DefectEntryModel(
        id: DateTime.now().millisecondsSinceEpoch.toString(),
        defectCode: 'D-${(_model.defects.length + 1).toString().padLeft(2, '0')}',
        floorName: 'Tầng 1',
        roomOrZone: '',
        structuralElement: StructuralElement.wall,
        defectType: DefectType.crack,
      ));
    });
  }

  Widget _buildDefectCard(int index, DefectEntryModel defect) {
    return Card(
      elevation: 2,
      margin: const EdgeInsets.only(bottom: 12),
      child: ExpansionTile(
        title: Text('${defect.defectCode} - ${defect.defectType.label}', style: const TextStyle(fontWeight: FontWeight.bold, color: AppTheme.secondary)),
        subtitle: Text('${defect.floorName} - ${defect.structuralElement.label}'),
        children: [
          Padding(
            padding: const EdgeInsets.all(12),
            child: Column(
              children: [
                Row(
                  children: [
                    Expanded(child: _buildTextInput('Tầng', defect.floorName, (v) => defect.floorName = v)),
                    const SizedBox(width: 8),
                    Expanded(child: _buildTextInput('Khu vực', defect.roomOrZone, (v) => defect.roomOrZone = v)),
                  ],
                ),
                const SizedBox(height: 8),
                DropdownButtonFormField<DefectType>(
                  value: defect.defectType,
                  decoration: const InputDecoration(labelText: 'Loại khuyết tật', border: OutlineInputBorder()),
                  items: DefectType.values.map((e) => DropdownMenuItem(value: e, child: Text(e.label))).toList(),
                  onChanged: (v) => setState(() => defect.defectType = v!),
                ),
                const SizedBox(height: 8),
                if (defect.defectType == DefectType.crack)
                  Row(
                    children: [
                      Expanded(child: _buildNumberInputDouble('Bề rộng (mm)', defect.maxCrackWidthMm ?? 0, (v) => defect.maxCrackWidthMm = v)),
                      const SizedBox(width: 8),
                      Expanded(child: _buildNumberInputDouble('Chiều dài (m)', defect.crackLengthM ?? 0, (v) => defect.crackLengthM = v)),
                    ],
                  ),
                const SizedBox(height: 12),
                const SizedBox(height: 12),
                MediaPickerWidget(
                  label: 'Ảnh bối cảnh (CTX)',
                  watermarkText: '${widget.buildingCode}-CTX-${defect.defectCode}',
                  onImageSelected: (bytes, filename) => setState(() => defect.ctxPhotoUrl = filename),
                ),
                MediaPickerWidget(
                  label: 'Ảnh cận (CU - có thước)',
                  watermarkText: '${widget.buildingCode}-CU-${defect.defectCode}',
                  onImageSelected: (bytes, filename) => setState(() => defect.cuPhotoUrl = filename),
                ),
                const SizedBox(height: 8),
                Align(
                  alignment: Alignment.centerRight,
                  child: TextButton.icon(
                    onPressed: () => setState(() => _model.defects.removeAt(index)),
                    icon: const Icon(Icons.delete, color: Colors.red),
                    label: const Text('Xóa', style: TextStyle(color: Colors.red)),
                  ),
                )
              ],
            ),
          )
        ],
      ),
    );
  }

  Widget _buildStep5Tilt() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('5. Đo đạc Lún / Nghiêng', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
        const SizedBox(height: 16),
        ..._model.tiltRecords.asMap().entries.map((e) => _buildTiltCard(e.key, e.value)).toList(),
        const SizedBox(height: 16),
        ElevatedButton.icon(
          onPressed: () {
            setState(() {
              _model.tiltRecords.add(TiltSettlementRecord(location: '', targetObject: '', measuredValue: ''));
            });
          },
          icon: const Icon(Icons.add),
          label: const Text('Thêm điểm đo lún/nghiêng'),
        )
      ],
    );
  }

  Widget _buildTiltCard(int index, TiltSettlementRecord r) {
    return Card(
      elevation: 2,
      margin: const EdgeInsets.only(bottom: 12),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          children: [
            _buildTextInput('Vị trí', r.location, (v) => r.location = v),
            const SizedBox(height: 8),
            _buildTextInput('Đối tượng đo', r.targetObject, (v) => r.targetObject = v),
            const SizedBox(height: 8),
            _buildTextInput('Giá trị đo được', r.measuredValue, (v) => r.measuredValue = v),
            const SizedBox(height: 8),
            _buildTextInput('Phương pháp (Máy toàn đạc, dây dọi...)', r.method, (v) => r.method = v),
            Align(
              alignment: Alignment.centerRight,
              child: IconButton(icon: const Icon(Icons.delete, color: Colors.red), onPressed: () => setState(() => _model.tiltRecords.removeAt(index))),
            )
          ],
        ),
      ),
    );
  }

  Widget _buildStep6Sketch() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('6. Sơ đồ vị trí khuyết tật (Sketch)', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
        const SizedBox(height: 16),
        DefectPinningWidget(
          onPinsChanged: (pins) {
            // Lưu trạng thái của pins nếu cần
          },
        ),
        const SizedBox(height: 16),
        _buildTextInput('Ghi chú sơ đồ', _model.sketchNotes ?? '', (v) => _model.sketchNotes = v),
      ],
    );
  }

  Widget _buildStep7Summary() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const Icon(Icons.check_circle_outline, size: 80, color: AppTheme.success),
        const SizedBox(height: 16),
        const Text('Tổng kết Hiện trạng Phase 2', textAlign: TextAlign.center, style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold)),
        const SizedBox(height: 24),
        DropdownButtonFormField<DeltaComparison>(
          value: _model.deltaStatus,
          decoration: const InputDecoration(labelText: 'Khuyết tật so với GĐ1', border: OutlineInputBorder()),
          items: DeltaComparison.values.map((e) => DropdownMenuItem(value: e, child: Text(e.name))).toList(),
          onChanged: (v) => setState(() => _model.deltaStatus = v!),
        ),
        const SizedBox(height: 16),
        _buildTextInput('Ý kiến chủ hộ', _model.ownerComments, (v) => _model.ownerComments = v),
        const SizedBox(height: 16),
        ElevatedButton.icon(
          onPressed: () {},
          icon: const Icon(Icons.draw),
          label: const Text('Chữ ký Chủ hộ / Người khảo sát'),
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
              onPressed: _isSubmitting ? null : _submitPhase2,
              style: ElevatedButton.styleFrom(backgroundColor: AppTheme.success),
              child: _isSubmitting ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2)) : const Text('Hoàn tất Phase 2'),
            ),
        ],
      ),
    );
  }

  Widget _buildTextInput(String label, String value, Function(String) onChanged) {
    return TextFormField(
      initialValue: value,
      decoration: InputDecoration(labelText: label, border: const OutlineInputBorder()),
      onChanged: onChanged,
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

  Widget _buildPhotoCaptureButton(String label, String? currentUrl, Function(String) onCaptured) {
    bool hasPhoto = currentUrl != null && currentUrl.isNotEmpty;
    return InkWell(
      onTap: () => onCaptured('mock_url_${DateTime.now().millisecondsSinceEpoch}.jpg'), // Giả lập chụp ảnh
      child: Container(
        height: 60,
        decoration: BoxDecoration(
          color: hasPhoto ? AppTheme.success.withOpacity(0.1) : Colors.grey[200],
          border: Border.all(color: hasPhoto ? AppTheme.success : Colors.grey),
          borderRadius: BorderRadius.circular(8),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(hasPhoto ? Icons.check_circle : Icons.camera_alt, color: hasPhoto ? AppTheme.success : Colors.grey[700]),
            const SizedBox(width: 8),
            Text(hasPhoto ? 'Đã chụp' : label, style: TextStyle(color: hasPhoto ? AppTheme.success : Colors.grey[700], fontWeight: FontWeight.bold)),
          ],
        ),
      ),
    );
  }
}
