import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import '../core/constants/api_constants.dart';

class FootprintMapWidget extends StatefulWidget {
  final LatLng initialCenter;
  final Function(List<LatLng>) onPolygonChanged;

  const FootprintMapWidget({
    Key? key,
    required this.initialCenter,
    required this.onPolygonChanged,
  }) : super(key: key);

  @override
  State<FootprintMapWidget> createState() => FootprintMapWidgetState();
}

class FootprintMapWidgetState extends State<FootprintMapWidget> {
  final List<LatLng> _points = [];

  void clearPoints() {
    setState(() {
      _points.clear();
    });
    widget.onPolygonChanged(_points);
  }

  void loadSampleFootprint() {
    final c = widget.initialCenter;
    setState(() {
      _points.clear();
      _points.addAll([
        LatLng(c.latitude + 0.00003, c.longitude - 0.00004),
        LatLng(c.latitude + 0.00005, c.longitude + 0.00004),
        LatLng(c.latitude - 0.00003, c.longitude + 0.00006),
        LatLng(c.latitude - 0.00004, c.longitude - 0.00003),
      ]);
    });
    widget.onPolygonChanged(_points);
  }

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(10),
      child: SizedBox(
        height: 220,
        width: double.infinity,
        child: FlutterMap(
          options: MapOptions(
            initialCenter: widget.initialCenter,
            initialZoom: 19.0,
            onTap: (tapPosition, point) {
              setState(() {
                _points.add(point);
              });
              widget.onPolygonChanged(_points);
            },
          ),
          children: [
            TileLayer(
              urlTemplate: ApiConstants.esriSatelliteTileUrl,
              maxZoom: 20,
            ),
            if (_points.length >= 3)
              PolygonLayer(
                polygons: [
                  Polygon(
                    points: _points,
                    color: const Color(0xFF10B981).withOpacity(0.4),
                    borderColor: const Color(0xFF10B981),
                    borderStrokeWidth: 2.5,
                    isFilled: true,
                  ),
                ],
              ),
            PolylineLayer(
              polylines: [
                Polyline(
                  points: _points,
                  color: const Color(0xFF38BDF8),
                  strokeWidth: 2.0,
                ),
              ],
            ),
            MarkerLayer(
              markers: _points
                  .map((p) => Marker(
                        point: p,
                        width: 10,
                        height: 10,
                        child: Container(
                          decoration: BoxDecoration(
                            color: const Color(0xFF0284C7),
                            shape: BoxShape.circle,
                            border: Border.all(color: Colors.white, width: 2),
                          ),
                        ),
                      ))
                  .toList(),
            ),
          ],
        ),
      ),
    );
  }
}
