import 'package:flutter/material.dart';
import '../../models/phase1_model.dart';
import '../../core/theme/app_theme.dart';

// ============================================================================
// ECS SCORER WIDGET
// UI cho phép cán bộ chấm điểm E1-E6, hiển thị mô tả và live preview kết quả
// ============================================================================

class EcsScorerWidget extends StatelessWidget {
  final String code;       // 'E1', 'E2'...
  final String title;      // 'Nứt kết cấu chịu lực'
  final List<String> levelDescriptions; // 0=Không có, 1=Nhẹ, 2=Trung bình, 3=Nặng, 4=Nguy cấp
  final int currentValue;
  final ValueChanged<int> onChanged;
  final bool isStructuralComponent; // E1, E3 → hiển thị badge OVERRIDE

  const EcsScorerWidget({
    Key? key,
    required this.code,
    required this.title,
    required this.levelDescriptions,
    required this.currentValue,
    required this.onChanged,
    this.isStructuralComponent = false,
  }) : super(key: key);

  static const _levelColors = [
    Color(0xFF10B981), // 0 — Xanh
    Color(0xFF84CC16), // 1 — Xanh vàng
    Color(0xFFF59E0B), // 2 — Vàng
    Color(0xFFF97316), // 3 — Cam
    Color(0xFFEF4444), // 4 — Đỏ
  ];

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: currentValue > 0 ? _levelColors[currentValue].withOpacity(0.4) : AppTheme.border,
          width: currentValue > 0 ? 1.5 : 1,
        ),
        boxShadow: currentValue >= 3 ? [
          BoxShadow(
            color: _levelColors[currentValue].withOpacity(0.12),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ] : null,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            decoration: BoxDecoration(
              color: currentValue > 0
                  ? _levelColors[currentValue].withOpacity(0.06)
                  : Colors.grey.shade50,
              borderRadius: const BorderRadius.vertical(top: Radius.circular(11)),
            ),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: AppTheme.primary,
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text(code,
                    style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold)),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(title,
                    style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13, color: AppTheme.textMain)),
                ),
                if (isStructuralComponent)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                    decoration: BoxDecoration(
                      color: const Color(0xFFFFF1F2),
                      border: Border.all(color: AppTheme.danger.withOpacity(0.4)),
                      borderRadius: BorderRadius.circular(5),
                    ),
                    child: Text('OVERRIDE', style: TextStyle(fontSize: 9, color: AppTheme.danger, fontWeight: FontWeight.bold)),
                  ),
                const SizedBox(width: 8),
                _ScoreBadge(value: currentValue, color: _levelColors[currentValue]),
              ],
            ),
          ),

          // Score buttons: 0 — 4
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            child: Row(
              children: List.generate(5, (i) {
                final isSelected = currentValue == i;
                return Expanded(
                  child: GestureDetector(
                    onTap: () => onChanged(i),
                    child: AnimatedContainer(
                      duration: const Duration(milliseconds: 200),
                      margin: const EdgeInsets.symmetric(horizontal: 3),
                      padding: const EdgeInsets.symmetric(vertical: 10),
                      decoration: BoxDecoration(
                        color: isSelected ? _levelColors[i] : Colors.grey.shade100,
                        borderRadius: BorderRadius.circular(8),
                        boxShadow: isSelected ? [
                          BoxShadow(color: _levelColors[i].withOpacity(0.35), blurRadius: 6, offset: const Offset(0,2))
                        ] : null,
                      ),
                      child: Text('$i',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          color: isSelected ? Colors.white : Colors.grey.shade500,
                          fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                          fontSize: 15,
                        ),
                      ),
                    ),
                  ),
                );
              }),
            ),
          ),

          // Description of current level
          if (currentValue < levelDescriptions.length)
            Padding(
              padding: const EdgeInsets.only(left: 14, right: 14, bottom: 10),
              child: Row(
                children: [
                  Icon(Icons.info_outline, size: 13, color: _levelColors[currentValue]),
                  const SizedBox(width: 5),
                  Expanded(
                    child: Text(
                      levelDescriptions[currentValue],
                      style: TextStyle(fontSize: 11.5, color: _levelColors[currentValue], height: 1.4),
                    ),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}

class _ScoreBadge extends StatelessWidget {
  final int value;
  final Color color;
  const _ScoreBadge({required this.value, required this.color});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 32, height: 32,
      decoration: BoxDecoration(
        color: color,
        shape: BoxShape.circle,
      ),
      child: Center(
        child: Text('$value',
          style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14)),
      ),
    );
  }
}

// ============================================================================
// ECS RESULT SUMMARY CARD — Hiển thị kết quả sau khi chấm điểm
// ============================================================================


// ============================================================================
// VI DISPLAY WIDGET — Hiển thị kết quả VI với auto-map V3/V5
// ============================================================================

class ViDisplayWidget extends StatelessWidget {
  final int v1, v2, v3Mapped, v4, v5Mapped, v6;

  const ViDisplayWidget({
    Key? key,
    required this.v1, required this.v2, required this.v3Mapped,
    required this.v4, required this.v5Mapped, required this.v6,
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    final total = v1 + v2 + v3Mapped + v4 + v5Mapped + v6;
    final avg = total / 6.0;
    ViClass viClass;
    Color viColor;
    if (avg <= 1.5) { viClass = ViClass.low; viColor = const Color(0xFF10B981); }
    else if (avg <= 2.5) { viClass = ViClass.medium; viColor = const Color(0xFFF59E0B); }
    else if (avg <= 3.25) { viClass = ViClass.high; viColor = const Color(0xFFF97316); }
    else { viClass = ViClass.veryHigh; viColor = const Color(0xFFEF4444); }

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: viColor.withOpacity(0.05),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: viColor.withOpacity(0.3)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Text('VI TRUNG BÌNH', style: TextStyle(fontSize: 10, color: AppTheme.textMuted, letterSpacing: 0.8)),
              const Spacer(),
              Text('${avg.toStringAsFixed(2)} / 4.0',
                style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: viColor)),
            ],
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              _ViCell('V1', v1),
              _ViCell('V2', v2),
              _ViCell('V3 ⚡', v3Mapped, isAuto: true),
              _ViCell('V4', v4),
              _ViCell('V5 ⚡', v5Mapped, isAuto: true),
              _ViCell('V6', v6),
            ].map((e) => Expanded(child: e)).toList(),
          ),
          const SizedBox(height: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
            decoration: BoxDecoration(color: viColor, borderRadius: BorderRadius.circular(8)),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text('Dễ tổn thương: ', style: const TextStyle(color: Colors.white, fontSize: 11)),
                Text(viClass.label,
                  style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 12)),
              ],
            ),
          ),
          const SizedBox(height: 4),
          Text('⚡ V3, V5 được tính tự động từ dữ liệu Móng và ECS',
            style: TextStyle(fontSize: 9.5, color: Colors.grey.shade500)),
        ],
      ),
    );
  }
}

class _ViCell extends StatelessWidget {
  final String label;
  final int value;
  final bool isAuto;
  const _ViCell(this.label, this.value, {this.isAuto = false});

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Text(label, style: TextStyle(fontSize: 8.5, color: isAuto ? AppTheme.primary : AppTheme.textMuted, fontWeight: isAuto ? FontWeight.bold : FontWeight.normal)),
        const SizedBox(height: 2),
        Text('$value', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: isAuto ? AppTheme.primary : AppTheme.textMain)),
      ],
    );
  }
}

// ============================================================================
// COMPLETENESS HUD — Thanh tiến độ hoàn thành từng bước
// ============================================================================

class CompletenessHud extends StatelessWidget {
  final int completedSteps;
  final int totalSteps;
  final List<String> missingItems;

  const CompletenessHud({
    Key? key,
    required this.completedSteps,
    required this.totalSteps,
    this.missingItems = const [],
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    final pct = completedSteps / totalSteps;
    final color = pct < 0.5 ? AppTheme.danger : pct < 1.0 ? AppTheme.warning : AppTheme.success;

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: color.withOpacity(0.06),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: color.withOpacity(0.25)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(pct >= 1.0 ? Icons.check_circle : Icons.pending, size: 14, color: color),
              const SizedBox(width: 6),
              Text('$completedSteps / $totalSteps mục hoàn thành',
                style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: color)),
              const Spacer(),
              Text('${(pct * 100).round()}%',
                style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: color)),
            ],
          ),
          const SizedBox(height: 6),
          LinearProgressIndicator(
            value: pct,
            backgroundColor: color.withOpacity(0.15),
            valueColor: AlwaysStoppedAnimation(color),
            borderRadius: BorderRadius.circular(4),
            minHeight: 5,
          ),
          if (missingItems.isNotEmpty) ...[
            const SizedBox(height: 6),
            ...missingItems.map((item) => Padding(
              padding: const EdgeInsets.only(top: 2),
              child: Row(
                children: [
                  const Icon(Icons.circle, size: 4, color: AppTheme.danger),
                  const SizedBox(width: 6),
                  Text(item, style: const TextStyle(fontSize: 10.5, color: AppTheme.danger)),
                ],
              ),
            )),
          ],
        ],
      ),
    );
  }
}

// ============================================================================
// BRA MATRIX WIDGET — Bảng ma trận rủi ro tương tác
// ============================================================================

class BraMatrixWidget extends StatelessWidget {
  final ViClass viClass;
  final String impactClass; // 'I1_LOW', 'I2_MEDIUM', 'I3_HIGH', 'I4_VERY_HIGH', 'PENDING'

  const BraMatrixWidget({Key? key, required this.viClass, required this.impactClass}) : super(key: key);

  static const _matrix = {
    'LOW':       {'I1_LOW': 'LOW', 'I2_MEDIUM': 'LOW',    'I3_HIGH': 'MEDIUM', 'I4_VERY_HIGH': 'HIGH'},
    'MEDIUM':    {'I1_LOW': 'LOW', 'I2_MEDIUM': 'MEDIUM', 'I3_HIGH': 'MEDIUM', 'I4_VERY_HIGH': 'HIGH'},
    'HIGH':      {'I1_LOW': 'MEDIUM', 'I2_MEDIUM': 'MEDIUM', 'I3_HIGH': 'HIGH', 'I4_VERY_HIGH': 'VERY_HIGH'},
    'VERY_HIGH': {'I1_LOW': 'HIGH', 'I2_MEDIUM': 'HIGH', 'I3_HIGH': 'VERY_HIGH', 'I4_VERY_HIGH': 'VERY_HIGH'},
  };

  static Color _braColor(String? val) {
    switch (val) {
      case 'LOW':       return const Color(0xFF10B981);
      case 'MEDIUM':    return const Color(0xFFF59E0B);
      case 'HIGH':      return const Color(0xFFF97316);
      case 'VERY_HIGH': return const Color(0xFFEF4444);
      default:          return Colors.grey;
    }
  }

  @override
  Widget build(BuildContext context) {
    final rows = ['VERY_HIGH', 'HIGH', 'MEDIUM', 'LOW'];
    final cols = ['I1_LOW', 'I2_MEDIUM', 'I3_HIGH', 'I4_VERY_HIGH'];
    final viKey = viClass.name.toUpperCase().replaceAll('VERYHIGH', 'VERY_HIGH');

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Column headers
        Row(
          children: [
            const SizedBox(width: 80),
            ...cols.map((c) => Expanded(
              child: Center(
                child: Text(c.replaceAll('_', '\n'),
                  textAlign: TextAlign.center,
                  style: TextStyle(fontSize: 8, color: AppTheme.textMuted,
                    fontWeight: c == impactClass ? FontWeight.bold : FontWeight.normal)),
              ),
            )),
          ],
        ),
        const SizedBox(height: 4),
        ...rows.map((rowKey) {
          final isActiveRow = rowKey == viKey;
          return Padding(
            padding: const EdgeInsets.only(bottom: 3),
            child: Row(
              children: [
                SizedBox(
                  width: 80,
                  child: Text(rowKey.replaceAll('_', '\n'),
                    style: TextStyle(fontSize: 8, fontWeight: isActiveRow ? FontWeight.bold : FontWeight.normal,
                      color: isActiveRow ? AppTheme.primary : AppTheme.textMuted)),
                ),
                ...cols.map((colKey) {
                  final val = _matrix[rowKey]?[colKey];
                  final isActive = isActiveRow && colKey == impactClass;
                  return Expanded(
                    child: AnimatedContainer(
                      duration: const Duration(milliseconds: 300),
                      margin: const EdgeInsets.all(2),
                      height: 28,
                      decoration: BoxDecoration(
                        color: isActive ? _braColor(val) : _braColor(val).withOpacity(0.2),
                        borderRadius: BorderRadius.circular(6),
                        border: isActive ? Border.all(color: _braColor(val), width: 2) : null,
                        boxShadow: isActive ? [BoxShadow(color: _braColor(val).withOpacity(0.4), blurRadius: 6)] : null,
                      ),
                      child: Center(
                        child: Text(val ?? '?',
                          style: TextStyle(
                            fontSize: 8,
                            fontWeight: isActive ? FontWeight.bold : FontWeight.normal,
                            color: isActive ? Colors.white : _braColor(val).withOpacity(0.8),
                          ),
                        ),
                      ),
                    ),
                  );
                }),
              ],
            ),
          );
        }),
        if (impactClass == 'PENDING')
          Padding(
            padding: const EdgeInsets.only(top: 8),
            child: Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: Colors.grey.shade100,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: Colors.grey.shade300),
              ),
              child: const Text(
                'BRA = PENDING: Chưa có dữ liệu dự báo tác động thi công Metro được phê duyệt.\n'
                'Kết quả BCS/ECS/VI đã đủ để lập hồ sơ nền. BRA sẽ cập nhật khi có Input I.',
                style: TextStyle(fontSize: 10, color: AppTheme.textMuted, height: 1.5),
              ),
            ),
          ),
      ],
    );
  }
}

// ============================================================================
// CRACK WIDTH STEPPER — Nút tăng/giảm bề rộng vết nứt chính xác (mm)
// ============================================================================

class CrackWidthStepper extends StatelessWidget {
  final double value;
  final ValueChanged<double> onChanged;
  final double step;
  final double min;
  final double max;

  const CrackWidthStepper({
    Key? key,
    required this.value,
    required this.onChanged,
    this.step = 0.1,
    this.min = 0.0,
    this.max = 25.0,
  }) : super(key: key);

  Color get _widthColor {
    if (value <= 0.2) return const Color(0xFF10B981);
    if (value <= 1.0) return const Color(0xFFF59E0B);
    if (value <= 5.0) return const Color(0xFFF97316);
    return const Color(0xFFEF4444);
  }

  String get _widthClassLabel {
    if (value <= 0.2) return 'Vi nứt';
    if (value <= 1.0) return 'Nhỏ';
    if (value <= 5.0) return 'Trung bình';
    return 'Lớn / Nguy cấp';
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            // Fine step -0.1mm
            _StepBtn(label: '-0.1', onTap: () => onChanged((value - 0.1).clamp(min, max))),
            const SizedBox(width: 6),
            // Coarse step -0.5mm
            _StepBtn(label: '-0.5', onTap: () => onChanged((value - 0.5).clamp(min, max))),
            const SizedBox(width: 12),
            // Display
            Expanded(
              child: Column(
                children: [
                  Text(value.toStringAsFixed(1),
                    textAlign: TextAlign.center,
                    style: TextStyle(fontSize: 28, fontWeight: FontWeight.bold, color: _widthColor)),
                  Text('mm', textAlign: TextAlign.center,
                    style: const TextStyle(fontSize: 11, color: AppTheme.textMuted)),
                ],
              ),
            ),
            const SizedBox(width: 12),
            // Coarse step +0.5mm
            _StepBtn(label: '+0.5', onTap: () => onChanged((value + 0.5).clamp(min, max))),
            const SizedBox(width: 6),
            // Fine step +0.1mm
            _StepBtn(label: '+0.1', onTap: () => onChanged((value + 0.1).clamp(min, max))),
          ],
        ),
        const SizedBox(height: 6),
        Center(
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(
              color: _widthColor.withOpacity(0.1),
              borderRadius: BorderRadius.circular(6),
              border: Border.all(color: _widthColor.withOpacity(0.3)),
            ),
            child: Text('Phân loại: $_widthClassLabel',
              style: TextStyle(fontSize: 11, color: _widthColor, fontWeight: FontWeight.w600)),
          ),
        ),
      ],
    );
  }
}

class _StepBtn extends StatelessWidget {
  final String label;
  final VoidCallback onTap;
  const _StepBtn({required this.label, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 10),
        decoration: BoxDecoration(
          color: Colors.grey.shade100,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: AppTheme.border),
        ),
        child: Text(label,
          style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: AppTheme.textMain)),
      ),
    );
  }
}
