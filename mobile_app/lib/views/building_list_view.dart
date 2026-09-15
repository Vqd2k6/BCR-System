import 'package:flutter/material.dart';
import '../models/user_model.dart';
import '../models/zone_model.dart';
import '../services/api_service.dart';
import 'phase1_wizard_view.dart';
import 'phase2_wizard_view.dart';

class BuildingListView extends StatelessWidget {
  final SurveyZoneModel zone;
  final UserModel user;
  final ApiService apiService;

  const BuildingListView({
    Key? key,
    required this.zone,
    required this.user,
    required this.apiService,
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    // Mock data for buildings in this zone
    final mockBuildings = [
      {
        'id': 'B-TB-BH-001',
        'address': '12 Trường Chinh, P.12, Q.TB',
        'status': 'CHƯA LÀM',
      },
      {
        'id': 'B-TB-BH-002',
        'address': '15 Trường Chinh, P.12, Q.TB',
        'status': 'ĐANG LÀM P1',
      },
      {
        'id': 'B-TB-BH-003',
        'address': '20 Trường Chinh, P.12, Q.TB',
        'status': 'HOÀN THÀNH P1',
      },
    ];

    return Scaffold(
      appBar: AppBar(
        title: Text('Danh sách: ${zone.name}'),
        actions: [
          IconButton(
            icon: const Icon(Icons.add),
            tooltip: 'Tạo hồ sơ mới',
            onPressed: () {
              Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (context) => Phase1WizardView(
                    buildingId: 'B-TB-BH-NEW',
                    buildingCode: 'B-TB-BH-NEW',
                    ownerName: '',
                    address: '',
                    foundationCat: 5,
                    user: user,
                    apiService: apiService,
                  ),
                ),
              );
            },
          )
        ],
      ),
      body: ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: mockBuildings.length,
        itemBuilder: (context, index) {
          final b = mockBuildings[index];
          final isP1Done = b['status'] == 'HOÀN THÀNH P1';
          return Card(
            margin: const EdgeInsets.only(bottom: 12),
            child: ListTile(
              title: Text(b['id']!, style: const TextStyle(fontWeight: FontWeight.bold)),
              subtitle: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(b['address']!),
                  const SizedBox(height: 4),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: isP1Done ? Colors.green.withOpacity(0.1) : Colors.orange.withOpacity(0.1),
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: Text(
                      b['status']!,
                      style: TextStyle(
                        fontSize: 12,
                        color: isP1Done ? Colors.green[700] : Colors.orange[800],
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                ],
              ),
              trailing: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  IconButton(
                    icon: const Icon(Icons.edit_document, color: Colors.blue),
                    tooltip: 'Khảo sát Phase 1',
                    onPressed: () {
                      Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (context) => Phase1WizardView(
                            buildingId: b['id']!,
                            buildingCode: b['id']!,
                            ownerName: 'Nguyễn Văn A',
                            address: b['address']!,
                            foundationCat: 5,
                            user: user,
                            apiService: apiService,
                          ),
                        ),
                      );
                    },
                  ),
                  if (isP1Done)
                    IconButton(
                      icon: const Icon(Icons.assignment_turned_in, color: Colors.orange),
                      tooltip: 'Khảo sát Phase 2',
                      onPressed: () {
                        Navigator.push(
                          context,
                          MaterialPageRoute(
                            builder: (context) => Phase2WizardView(
                              buildingId: b['id']!,
                              buildingCode: b['id']!,
                              ownerName: 'Nguyễn Văn A',
                              address: b['address']!,
                              phase1Id: 'P1-${b['id']}',
                              phase1EcsClass: 'Trung bình',
                              phase1BraResult: 'Thấp',
                              user: user,
                              apiService: apiService,
                            ),
                          ),
                        );
                      },
                    ),
                ],
              ),
            ),
          );
        },
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () {
          Navigator.push(
            context,
            MaterialPageRoute(
              builder: (context) => Phase1WizardView(
                buildingId: 'B-TB-BH-NEW',
                buildingCode: 'B-TB-BH-NEW',
                ownerName: '',
                address: '',
                foundationCat: 5,
                user: user,
                apiService: apiService,
              ),
            ),
          );
        },
        label: const Text('Tạo mới Phase 1'),
        icon: const Icon(Icons.add),
      ),
    );
  }
}
