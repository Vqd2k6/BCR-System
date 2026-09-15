import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';

class DefectPin {
  final double xRatio;
  final double yRatio;
  final String label;
  final Color color;

  DefectPin({
    required this.xRatio,
    required this.yRatio,
    required this.label,
    this.color = Colors.red,
  });
}

class DefectPinningWidget extends StatefulWidget {
  final List<DefectPin> initialPins;
  final Function(List<DefectPin>) onPinsChanged;
  
  const DefectPinningWidget({
    Key? key,
    this.initialPins = const [],
    required this.onPinsChanged,
  }) : super(key: key);

  @override
  State<DefectPinningWidget> createState() => _DefectPinningWidgetState();
}

class _DefectPinningWidgetState extends State<DefectPinningWidget> {
  Uint8List? _imageBytes;
  final ImagePicker _picker = ImagePicker();
  List<DefectPin> _pins = [];
  int _pinCounter = 1;

  @override
  void initState() {
    super.initState();
    _pins = List.from(widget.initialPins);
  }

  Future<void> _pickImage() async {
    try {
      final XFile? image = await _picker.pickImage(source: ImageSource.gallery);
      if (image != null) {
        final bytes = await image.readAsBytes();
        setState(() {
          _imageBytes = bytes;
          _pins.clear();
          _pinCounter = 1;
        });
        widget.onPinsChanged(_pins);
      }
    } catch (e) {
      debugPrint('Error picking image: $e');
    }
  }

  void _handleTap(TapUpDetails details, BoxConstraints constraints) {
    if (_imageBytes == null) return;
    
    final RenderBox? box = context.findRenderObject() as RenderBox?;
    if (box == null) return;

    // Calculate ratio based on constraints of the image container
    final double xRatio = details.localPosition.dx / constraints.maxWidth;
    final double yRatio = details.localPosition.dy / constraints.maxHeight;

    setState(() {
      _pins.add(
        DefectPin(
          xRatio: xRatio,
          yRatio: yRatio,
          label: 'D-${_pinCounter.toString().padLeft(2, '0')}',
        ),
      );
      _pinCounter++;
    });
    widget.onPinsChanged(_pins);
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (_imageBytes == null)
          Container(
            height: 200,
            decoration: BoxDecoration(
              border: Border.all(color: Colors.grey.shade400, style: BorderStyle.solid),
              borderRadius: BorderRadius.circular(8),
              color: Colors.grey.shade50,
            ),
            child: Center(
              child: ElevatedButton.icon(
                icon: const Icon(Icons.upload_file),
                label: const Text('Nạp bản vẽ CAD / Chụp phác thảo'),
                onPressed: _pickImage,
              ),
            ),
          )
        else
          Column(
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('Chạm vào ảnh để ghim khuyết tật', style: TextStyle(fontStyle: FontStyle.italic)),
                  TextButton.icon(
                    icon: const Icon(Icons.refresh, size: 16),
                    label: const Text('Đổi ảnh'),
                    onPressed: _pickImage,
                  ),
                ],
              ),
              LayoutBuilder(
                builder: (context, constraints) {
                  return GestureDetector(
                    onTapUp: (details) => _handleTap(details, constraints),
                    child: Stack(
                      children: [
                        Image.memory(
                          _imageBytes!,
                          width: double.infinity,
                          fit: BoxFit.contain,
                        ),
                        ..._pins.map((pin) {
                          return Positioned(
                            left: pin.xRatio * constraints.maxWidth - 12,
                            top: pin.yRatio * constraints.maxHeight - 24,
                            child: GestureDetector(
                              onDoubleTap: () {
                                setState(() {
                                  _pins.remove(pin);
                                });
                                widget.onPinsChanged(_pins);
                              },
                              child: Column(
                                children: [
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
                                    decoration: BoxDecoration(
                                      color: pin.color,
                                      borderRadius: BorderRadius.circular(4),
                                    ),
                                    child: Text(
                                      pin.label,
                                      style: const TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold),
                                    ),
                                  ),
                                  Icon(Icons.location_on, color: pin.color, size: 24),
                                ],
                              ),
                            ),
                          );
                        }).toList(),
                      ],
                    ),
                  );
                },
              ),
              const SizedBox(height: 8),
              const Text('Mẹo: Nhấp đúp vào một ghim để xóa nó.', style: TextStyle(fontSize: 11, color: Colors.grey)),
            ],
          ),
      ],
    );
  }
}
