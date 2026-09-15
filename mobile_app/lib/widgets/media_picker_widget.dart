import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';

class MediaPickerWidget extends StatefulWidget {
  final String label;
  final String? watermarkText;
  final Function(Uint8List? bytes, String? filename) onImageSelected;
  final bool allowPdf;
  
  const MediaPickerWidget({
    Key? key,
    required this.label,
    this.watermarkText,
    required this.onImageSelected,
    this.allowPdf = false,
  }) : super(key: key);

  @override
  State<MediaPickerWidget> createState() => _MediaPickerWidgetState();
}

class _MediaPickerWidgetState extends State<MediaPickerWidget> {
  Uint8List? _imageBytes;
  String? _filename;
  final ImagePicker _picker = ImagePicker();
  bool _isLoading = false;

  Future<void> _pickImage(ImageSource source) async {
    setState(() => _isLoading = true);
    try {
      final XFile? image = await _picker.pickImage(source: source, imageQuality: 80);
      if (image != null) {
        final bytes = await image.readAsBytes();
        setState(() {
          _imageBytes = bytes;
          _filename = image.name;
        });
        widget.onImageSelected(bytes, image.name);
      }
    } catch (e) {
      debugPrint('Error picking image: $e');
    }
    setState(() => _isLoading = false);
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        border: Border.all(color: Colors.grey.shade300),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.all(12),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Expanded(
                  child: Text(widget.label, style: const TextStyle(fontWeight: FontWeight.bold)),
                ),
                if (_imageBytes != null)
                  IconButton(
                    icon: const Icon(Icons.delete, color: Colors.red),
                    onPressed: () {
                      setState(() {
                        _imageBytes = null;
                        _filename = null;
                      });
                      widget.onImageSelected(null, null);
                    },
                  ),
              ],
            ),
          ),
          if (_isLoading)
            const Padding(
              padding: EdgeInsets.all(32),
              child: Center(child: CircularProgressIndicator()),
            )
          else if (_imageBytes != null)
            Stack(
              children: [
                Image.memory(
                  _imageBytes!,
                  width: double.infinity,
                  height: 200,
                  fit: BoxFit.cover,
                ),
                if (widget.watermarkText != null)
                  Positioned(
                    bottom: 0,
                    left: 0,
                    right: 0,
                    child: Container(
                      padding: const EdgeInsets.all(8),
                      color: Colors.black.withOpacity(0.6),
                      child: Text(
                        widget.watermarkText!,
                        style: const TextStyle(color: Colors.white, fontSize: 10),
                      ),
                    ),
                  ),
              ],
            )
          else
            Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  ElevatedButton.icon(
                    icon: const Icon(Icons.camera_alt),
                    label: const Text('Chụp ảnh'),
                    onPressed: () => _pickImage(ImageSource.camera),
                  ),
                  const SizedBox(width: 16),
                  OutlinedButton.icon(
                    icon: const Icon(Icons.photo_library),
                    label: Text(widget.allowPdf ? 'Chọn File/CAD' : 'Thư viện'),
                    onPressed: () => _pickImage(ImageSource.gallery),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}
