import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import '../models/user_model.dart';
import '../models/zone_model.dart';
import '../models/survey_model.dart';
import '../services/api_service.dart';
import '../services/gps_service.dart';
import '../services/watermark_service.dart';
import '../widgets/crack_painter_canvas.dart';
import '../widgets/footprint_map_widget.dart';
import '../core/constants/api_constants.dart';

class SurveyWizardView extends StatefulWidget {
  final SurveyZoneModel zone;
  final UserModel user;
  final ApiService apiService;

  const SurveyWizardView({
    Key? key,
    required this.zone,
    required this.user,
    required this.apiService,
  }) : super(key: key);

  @override
  State<SurveyWizardView> createState() => _SurveyWizardViewState();
}

class _SurveyWizardViewState extends State<SurveyWizardView> {
  int _currentStep = 1;
  final GlobalKey<FootprintMapWidgetState> _footprintKey = GlobalKey();

  // Step 1 Controllers
  final _houseCodeCtrl = TextEditingController(text: 'TB-BH-003');
  final _ownerNameCtrl = TextEditingController(text: 'Hoàng Minh Tâm');
  final _addressCtrl = TextEditingController(text: '156 Trường Chinh, P.12, Q. Tân Bình');

  LatLng _hardwareGps = const LatLng(10.797120, 106.653850);
  LatLng _pinGps = const LatLng(10.797125, 106.653855);
  double _deviationMeters = 0.7;

  // Step 2 Dynamic Structure
  late BuildingStructureModel _structure;

  // Step 4 Crack measurements
  double _crackLengthCm = 35.0;
  double _crackWidthMm = 0.8;

  // Step 5 Footprint
  List<LatLng> _footprintPoints = [];

  bool _isSubmitting = false;

  @override
  void initState() {
    super.initState();
    _structure = BuildingStructureModel(
      floors: [
        FloorModel(
          name: 'Tầng Trệt',
          rooms: [
            RoomModel(
              name: 'Phòng Khách',
              components: [
                ComponentModel(name: 'Tường trước', hasDefect: true, defectDescription: 'Nứt chân chim'),
                ComponentModel(name: 'Trần thạch cao', hasDefect: false),
              ],
            ),
          ],
        ),
      ],
    );
    _initGps();
  }

  Future<void> _initGps() async {
    final pos = await GpsService.getCurrentHardwareLocation();
    setState(() {
      _hardwareGps = pos;
      _pinGps = pos;
      _deviationMeters = GpsService.calculateDeviationMeters(_hardwareGps, _pinGps);
    });
  }

  void _addFloor() {
    setState(() {
      final fNum = _structure.floors.length + 1;
      _structure.floors.add(
        FloorModel(
          name: fNum == 1 ? 'Tầng Trệt' : 'Lầu ${fNum - 1}',
          rooms: [
            RoomModel(
              name: 'Phòng Chính',
              components: [
                ComponentModel(name: 'Tường'),
                ComponentModel(name: 'Sàn'),
              ],
            ),
          ],
        ),
      );
    });
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('Đã thêm Lầu ${_structure.floors.length - 1} vào cấu trúc nhà')),
    );
  }

  Future<void> _submitSurvey() async {
    setState(() => _isSubmitting = true);

    final survey = BuildingSurveyModel(
      houseCode: _houseCodeCtrl.text.trim(),
      ownerName: _ownerNameCtrl.text.trim(),
      address: _addressCtrl.text.trim(),
      zoneId: widget.zone.id,
      hardwareGps: _hardwareGps,
      pinGps: _pinGps,
      deviationMeters: _deviationMeters,
      footprint: _footprintPoints,
      structure: _structure,
      photos: [
        SurveyPhotoModel(
          photoUrl: 'https://r2.ksqh-metro2.vn/sample_crack.jpg',
          caption: 'Ảnh nứt tường phòng khách dập Watermark',
          watermarkText: WatermarkService.generateWatermarkText(
            hardwareGps: _hardwareGps,
            houseCode: _houseCodeCtrl.text.trim(),
            locationTag: 'TẦNG TRỆT / PHÒNG KHÁCH',
          ),
          capturedAt: DateTime.now(),
        ),
      ],
    );

    final success = await widget.apiService.submitSurvey(survey);
    setState(() => _isSubmitting = false);

    if (success && mounted) {
      showDialog(
        context: context,
        builder: (context) => AlertDialog(
          title: const Text('🎉 Nộp Hồ Sơ Thành Công!'),
          content: Text(
            'Hồ sơ công trình [${survey.houseCode}] đã được chuyển lên Web Admin để kiểm duyệt và đồng bộ GIS.',
          ),
          actions: [
            ElevatedButton(
              onPressed: () {
                Navigator.pop(context);
                Navigator.pop(context);
              },
              child: const Text('VỀ DANH SÁCH'),
            ),
          ],
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('Khảo Sát: ${_houseCodeCtrl.text}'),
      ),
      body: Column(
        children: [
          // Step Progress Bar
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            color: Colors.white,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: List.generate(6, (index) {
                final stepNum = index + 1;
                final isActive = stepNum == _currentStep;
                final isCompleted = stepNum < _currentStep;

                return InkWell(
                  onTap: () => setState(() => _currentStep = stepNum),
                  child: Column(
                    children: [
                      CircleAvatar(
                        radius: 13,
                        backgroundColor: isCompleted
                            ? const Color(0xFF10B981)
                            : (isActive ? const Color(0xFF0284C7) : const Color(0xFFE2E8F0)),
                        child: Text(
                          '$stepNum',
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.bold,
                            color: (isActive || isCompleted) ? Colors.white : const Color(0xFF64748B),
                          ),
                        ),
                      ),
                      const SizedBox(height: 3),
                      Text(
                        ['Vị trí', 'Cấu trúc', 'Camera', 'Vết nứt', 'Ranh giới', 'Nộp'][index],
                        style: TextStyle(
                          fontSize: 9.5,
                          fontWeight: isActive ? FontWeight.bold : FontWeight.normal,
                          color: isActive ? const Color(0xFF0284C7) : const Color(0xFF64748B),
                        ),
                      ),
                    ],
                  ),
                );
              }),
            ),
          ),
          const Divider(height: 1, color: Color(0xFFE2E8F0)),

          // Step Content
          Expanded(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(16),
              child: _buildStepContent(),
            ),
          ),

          // Bottom Bar
          Container(
            padding: const EdgeInsets.all(16),
            decoration: const BoxDecoration(
              color: Colors.white,
              border: Border(top: BorderSide(color: Color(0xFFE2E8F0))),
            ),
            child: Row(
              children: [
                if (_currentStep > 1)
                  OutlinedButton(
                    onPressed: () => setState(() => _currentStep--),
                    child: const Text('Quay lại'),
                  ),
                const Spacer(),
                if (_currentStep < 6)
                  ElevatedButton(
                    onPressed: () => setState(() => _currentStep++),
                    child: const Text('Tiếp theo →'),
                  )
                else
                  ElevatedButton(
                    onPressed: _isSubmitting ? null : _submitSurvey,
                    style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF10B981)),
                    child: _isSubmitting
                        ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                        : const Text('🚀 NỘP HỒ SƠ KHẢO SÁT'),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStepContent() {
    switch (_currentStep) {
      case 1:
        return _buildStep1DualGps();
      case 2:
        return _buildStep2DynamicStructure();
      case 3:
        return _buildStep3CameraWatermark();
      case 4:
        return _buildStep4CrackAnnotation();
      case 5:
        return _buildStep5FootprintMap();
      case 6:
        return _buildStep6ReviewSubmit();
      default:
        return const SizedBox();
    }
  }

  Widget _buildStep1DualGps() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Card(
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Column(
              children: [
                TextField(
                  controller: _houseCodeCtrl,
                  decoration: const InputDecoration(labelText: 'Mã căn khảo sát'),
                ),
                const SizedBox(height: 10),
                TextField(
                  controller: _ownerNameCtrl,
                  decoration: const InputDecoration(labelText: 'Tên chủ hộ / Đại diện'),
                ),
                const SizedBox(height: 10),
                TextField(
                  controller: _addressCtrl,
                  decoration: const InputDecoration(labelText: 'Địa chỉ thực tế'),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 12),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text('📍 Định vị GPS kép (Anti-Cheat)', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Color(0xFF0284C7))),
                    Text('Sai lệch: ${_deviationMeters.toStringAsFixed(1)}m', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: _deviationMeters > 50 ? Colors.red : const Color(0xFF0284C7))),
                  ],
                ),
                const SizedBox(height: 4),
                const Text('Kéo thả ghim để đặt đúng tâm mái nhà. Vị trí thực tế của bạn được ghi ngầm.', style: TextStyle(fontSize: 11, color: Color(0xFF64748B))),
                const SizedBox(height: 10),
                ClipRRect(
                  borderRadius: BorderRadius.circular(8),
                  child: SizedBox(
                    height: 180,
                    child: FlutterMap(
                      options: MapOptions(
                        initialCenter: _pinGps,
                        initialZoom: 19.0,
                        onTap: (tapPosition, point) {
                          setState(() {
                            _pinGps = point;
                            _deviationMeters = GpsService.calculateDeviationMeters(_hardwareGps, _pinGps);
                          });
                        },
                      ),
                      children: [
                        TileLayer(urlTemplate: ApiConstants.esriSatelliteTileUrl, maxZoom: 20),
                        MarkerLayer(
                          markers: [
                            Marker(
                              point: _hardwareGps,
                              width: 14,
                              height: 14,
                              child: Container(decoration: const BoxDecoration(color: Color(0xFF10B981), shape: BoxShape.circle, border: Border.fromBorderSide(BorderSide(color: Colors.white, width: 2)))),
                            ),
                            Marker(
                              point: _pinGps,
                              width: 24,
                              height: 24,
                              child: const Icon(Icons.location_on, color: Color(0xFF0284C7), size: 28),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildStep2DynamicStructure() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            const Text('🏢 Cây Cấu Trúc Khảo Sát', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
            ElevatedButton.icon(
              icon: const Icon(Icons.add, size: 16),
              label: const Text('Thêm Tầng'),
              onPressed: _addFloor,
              style: ElevatedButton.styleFrom(padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8)),
            ),
          ],
        ),
        const SizedBox(height: 12),
        ..._structure.floors.map((floor) => Card(
              margin: const EdgeInsets.only(bottom: 10),
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('🏢 ${floor.name}', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Color(0xFF0F172A))),
                    const SizedBox(height: 8),
                    ...floor.rooms.map((room) => Container(
                          padding: const EdgeInsets.all(8),
                          margin: const EdgeInsets.only(bottom: 6),
                          decoration: BoxDecoration(
                            color: const Color(0xFFF8FAFC),
                            borderRadius: BorderRadius.circular(6),
                            border: const Border(left: BorderSide(color: Color(0xFF0284C7), width: 3)),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text('🚪 ${room.name}', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: Color(0xFF0284C7))),
                              const SizedBox(height: 4),
                              Wrap(
                                spacing: 6,
                                children: room.components.map((comp) => Chip(
                                      label: Text('${comp.hasDefect ? '⚠️ ' : '🧱 '}${comp.name}'),
                                      backgroundColor: comp.hasDefect ? const Color(0xFFFEE2E2) : Colors.white,
                                      labelStyle: TextStyle(fontSize: 10, color: comp.hasDefect ? Colors.red : const Color(0xFF64748B)),
                                      padding: EdgeInsets.zero,
                                    )).toList(),
                              ),
                            ],
                          ),
                        )),
                  ],
                ),
              ),
            )),
      ],
    );
  }

  Widget _buildStep3CameraWatermark() {
    final watermarkText = WatermarkService.generateWatermarkText(
      hardwareGps: _hardwareGps,
      houseCode: _houseCodeCtrl.text,
      locationTag: 'NGOẠI THẤT / MẶT TIỀN',
    );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const Text('📸 Máy Ảnh Khảo Sát Hiện Trường', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
        const SizedBox(height: 10),
        ClipRRect(
          borderRadius: BorderRadius.circular(10),
          child: Stack(
            children: [
              Container(
                height: 220,
                color: const Color(0xFF1E293B),
                child: const Center(
                  child: Icon(Icons.camera_alt, color: Colors.white54, size: 48),
                ),
              ),
              Positioned(
                bottom: 0,
                left: 0,
                right: 0,
                child: Container(
                  padding: const EdgeInsets.all(8),
                  color: Colors.black.withOpacity(0.85),
                  child: Text(
                    watermarkText,
                    style: const TextStyle(color: Color(0xFF38BDF8), fontSize: 9.5, fontFamily: 'monospace'),
                  ),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 14),
        ElevatedButton.icon(
          icon: const Icon(Icons.camera, size: 18),
          label: const Text('CHỤP ẢNH & DẬP DẤU PHÁP LÝ'),
          onPressed: () {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(content: Text('📸 Đã chụp ảnh và đóng dấu Watermark GPS!')),
            );
            setState(() => _currentStep = 4);
          },
        ),
      ],
    );
  }

  Widget _buildStep4CrackAnnotation() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const Text('✏️ Vẽ & Đo Đạc Vết Nứt Trên Ảnh', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
        const SizedBox(height: 8),
        CrackPainterCanvas(
          lengthCm: _crackLengthCm,
          widthMm: _crackWidthMm,
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(
              child: TextField(
                decoration: const InputDecoration(labelText: 'Chiều dài (cm)'),
                keyboardType: TextInputType.number,
                controller: TextEditingController(text: '$_crackLengthCm'),
                onChanged: (val) => setState(() => _crackLengthCm = double.tryParse(val) ?? 35.0),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: TextField(
                decoration: const InputDecoration(labelText: 'Bề rộng khe (mm)'),
                keyboardType: TextInputType.number,
                controller: TextEditingController(text: '$_crackWidthMm'),
                onChanged: (val) => setState(() => _crackWidthMm = double.tryParse(val) ?? 0.8),
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildStep5FootprintMap() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            const Text('📐 Vẽ Đường Bao Nhà (Footprint)', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
            Text('${_footprintPoints.length} điểm', style: const TextStyle(fontWeight: FontWeight.bold, color: Color(0xFF0284C7))),
          ],
        ),
        const SizedBox(height: 8),
        FootprintMapWidget(
          key: _footprintKey,
          initialCenter: _pinGps,
          onPolygonChanged: (pts) => setState(() => _footprintPoints = pts),
        ),
        const SizedBox(height: 10),
        Row(
          children: [
            Expanded(
              child: OutlinedButton(
                onPressed: () => _footprintKey.currentState?.clearPoints(),
                child: const Text('Xóa vẽ lại'),
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: ElevatedButton(
                onPressed: () => _footprintKey.currentState?.loadSampleFootprint(),
                child: const Text('Dùng đường bao mẫu'),
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildStep6ReviewSubmit() {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Center(child: Text('📋', style: TextStyle(fontSize: 40))),
            const SizedBox(height: 8),
            const Center(
              child: Text(
                'Xác Nhận & Nộp Hồ Sơ Khảo Sát',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
              ),
            ),
            const Divider(height: 24),
            Text('• Mã căn: ${_houseCodeCtrl.text}', style: const TextStyle(fontWeight: FontWeight.bold)),
            Text('• Chủ hộ: ${_ownerNameCtrl.text}'),
            Text('• Địa chỉ: ${_addressCtrl.text}'),
            Text('• Sai lệch GPS: ${_deviationMeters.toStringAsFixed(1)}m (Hợp lệ)'),
            Text('• Số tầng khảo sát: ${_structure.floors.length} tầng'),
            Text('• Đa giác Footprint: ${_footprintPoints.length} đỉnh khép góc'),
            const SizedBox(height: 14),
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: const Color(0xFFDCFCE7),
                borderRadius: BorderRadius.circular(8),
              ),
              child: const Row(
                children: [
                  Icon(Icons.check_circle, color: Color(0xFF15803D), size: 20),
                  SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'Hồ sơ đã đầy đủ bằng chứng pháp lý và sẵn sàng kiểm duyệt.',
                      style: TextStyle(color: Color(0xFF15803D), fontSize: 11.5, fontWeight: FontWeight.w600),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
