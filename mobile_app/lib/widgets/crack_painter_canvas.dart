import 'package:flutter/material.dart';

class CrackPainterCanvas extends StatefulWidget {
  final double lengthCm;
  final double widthMm;
  final Function(List<Offset>)? onPointsChanged;

  const CrackPainterCanvas({
    Key? key,
    required this.lengthCm,
    required this.widthMm,
    this.onPointsChanged,
  }) : super(key: key);

  @override
  State<CrackPainterCanvas> createState() => _CrackPainterCanvasState();
}

class _CrackPainterCanvasState extends State<CrackPainterCanvas> {
  final List<Offset> _points = [];

  void clear() {
    setState(() {
      _points.clear();
    });
    if (widget.onPointsChanged != null) {
      widget.onPointsChanged!(_points);
    }
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onPanUpdate: (details) {
        final RenderBox renderBox = context.findRenderObject() as RenderBox;
        final localPosition = renderBox.globalToLocal(details.globalPosition);
        setState(() {
          _points.add(localPosition);
        });
        if (widget.onPointsChanged != null) {
          widget.onPointsChanged!(_points);
        }
      },
      child: ClipRRect(
        borderRadius: BorderRadius.circular(10),
        child: Container(
          width: double.infinity,
          height: 220,
          color: const Color(0xFF1E293B),
          child: CustomPaint(
            painter: _CrackPainter(
              points: _points,
              lengthCm: widget.lengthCm,
              widthMm: widget.widthMm,
            ),
          ),
        ),
      ),
    );
  }
}

class _CrackPainter extends CustomPainter {
  final List<Offset> points;
  final double lengthCm;
  final double widthMm;

  _CrackPainter({
    required this.points,
    required this.lengthCm,
    required this.widthMm,
  });

  @override
  void paint(Canvas canvas, Size size) {
    // 1. Vẽ lưới texture tường bê tông
    final gridPaint = Paint()
      ..color = Colors.white.withOpacity(0.06)
      ..strokeWidth = 1;
    for (double x = 0; x < size.width; x += 30) {
      canvas.drawLine(Offset(x, 0), Offset(x, size.height), gridPaint);
    }

    // 2. Vẽ đường nứt màu đỏ nổi bật
    if (points.isNotEmpty) {
      final crackPaint = Paint()
        ..color = const Color(0xFFEF4444)
        ..strokeWidth = 3.5
        ..strokeCap = StrokeCap.round
        ..strokeJoin = StrokeJoin.round;

      for (int i = 0; i < points.length - 1; i++) {
        canvas.drawLine(points[i], points[i + 1], crackPaint);
      }

      // 3. Gắn nhãn kích thước đo đạc
      final midPoint = points[points.length ~/ 2];
      final textSpan = TextSpan(
        text: ' Nứt: L=${lengthCm}cm | W=${widthMm}mm ',
        style: const TextStyle(
          color: Colors.white,
          fontSize: 10,
          fontWeight: FontWeight.bold,
          backgroundColor: Color(0xFFEF4444),
        ),
      );
      final textPainter = TextPainter(
        text: textSpan,
        textDirection: TextDirection.ltr,
      );
      textPainter.layout();
      textPainter.paint(canvas, Offset(midPoint.dx, midPoint.dy - 20));
    }
  }

  @override
  bool shouldRepaint(covariant _CrackPainter oldDelegate) => true;
}
