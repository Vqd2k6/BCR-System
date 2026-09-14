/**
 * MOCK DATA & REPOSITORY FOR KSQH METRO 2 PROTOTYPE
 */

const MOCK_DATA = {
  metroLine2: {
    name: "Tuyến Metro Số 2 (Bến Thành – Tham Lương)",
    color: "#ef4444",
    route: [
      [10.770876, 106.696946], // Ga Bến Thành (ST01)
      [10.773237, 106.690138], // Ga Tao Đàn (ST02)
      [10.780053, 106.677596], // Ga Dân Chủ (ST03)
      [10.782072, 106.673679], // Ga Hòa Hưng (ST04)
      [10.786163, 106.665623], // Ga Lê Thị Riêng (ST05)
      [10.789654, 106.659742], // Ga Phạm Văn Hai (ST06)
      [10.798691, 106.643181], // Ga Bảy Hiền (ST07)
      [10.806360, 106.634988], // Ga Nguyễn Hồng Đào (ST08)
      [10.810154, 106.633891], // Ga Bà Quẹo (ST09)
      [10.822124, 106.630160], // Ga Phạm Văn Bạch (ST10)
      [10.822111, 106.626127]  // Ga Tân Bình (ST11)
    ]
  },

  surveyZones: [
    {
      id: "ZONE-TB01",
      name: "Phân vùng 01: Đoạn Ga Bảy Hiền (Tân Bình)",
      surveyor: "Nguyễn Văn Hùng (Mã: NV-08)",
      polygon: [
        [10.7955, 106.6500],
        [10.7995, 106.6545],
        [10.7960, 106.6575],
        [10.7925, 106.6530]
      ],
      color: "#0284c7",
      totalHousesEst: 250,
      completed: 42
    },
    {
      id: "ZONE-Q302",
      name: "Phân vùng 02: Đoạn Ga Dân Chủ (Quận 3)",
      surveyor: "Trần Thị Mai (Mã: NV-12)",
      polygon: [
        [10.7765, 106.6790],
        [10.7810, 106.6840],
        [10.7775, 106.6870],
        [10.7735, 106.6820]
      ],
      color: "#a855f7",
      totalHousesEst: 180,
      completed: 28
    }
  ],

  // Sample buildings in the system
  buildings: [
    {
      id: "TB-BH-001",
      houseCode: "TB-BH-001",
      ownerName: "Trần Văn Phúc",
      address: "142 Trường Chinh, P.12, Q. Tân Bình",
      zoneId: "ZONE-TB01",
      status: "approved", // approved, pending, surveying, unassigned, rejected
      flagged: false,
      hardwareGps: { lat: 10.796510, lng: 106.653120 },
      pinGps: { lat: 10.796515, lng: 106.653125 },
      deviationMeters: 0.8,
      footprint: [
        [10.796540, 106.653080],
        [10.796560, 106.653160],
        [10.796480, 106.653180],
        [10.796460, 106.653100]
      ],
      surveyDate: "2026-09-12 09:30",
      surveyorName: "Nguyễn Văn Hùng",
      structure: {
        exterior: { condition: "Bình thường", notes: "Sơn tường ngoài hơi ố, kết cấu cột chịu lực ổn định" },
        floors: [
          {
            name: "Tầng Trệt",
            rooms: [
              {
                name: "Phòng khách",
                components: [
                  { name: "Tường trước", defects: "Vết nứt chân chim dài 45cm, rộng 0.5mm" },
                  { name: "Cột chịu lực", defects: "Không nứt" },
                  { name: "Sàn gạch", defects: "Bình thường" }
                ]
              }
            ]
          },
          {
            name: "Lầu 1",
            rooms: [
              {
                name: "Phòng ngủ 1",
                components: [
                  { name: "Tường hông", defects: "Nứt xé góc cửa sổ 25cm, rộng 1.2mm" }
                ]
              }
            ]
          }
        ]
      },
      photos: [
        {
          url: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='600' height='400' style='background:%23334155;'><rect width='100%25' height='100%25' fill='%231e293b'/><text x='50%25' y='45%25' fill='%2394a3b8' font-size='20' font-family='sans-serif' text-anchor='middle'>ẢNH HIỆN TRẠNG NGOẠI THẤT</text><text x='50%25' y='55%25' fill='%2338bdf8' font-size='16' font-family='sans-serif' text-anchor='middle'>Mã căn: TB-BH-001</text></svg>",
          caption: "Mặt tiền công trình",
          watermark: "GPS: 10.796510, 106.653120 | 2026-09-12 09:32:15 | TB-BH-001 | NGOAI THAT"
        },
        {
          url: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='600' height='400' style='background:%231e1e1e;'><rect width='100%25' height='100%25' fill='%23334155'/><path d='M 150 100 Q 250 200 400 280' stroke='%23ef4444' stroke-width='4' fill='none'/><text x='50%25' y='30%25' fill='%23ef4444' font-size='18' font-family='sans-serif' text-anchor='middle'>VẾT NỨT TƯỜNG (D: 45cm, R: 0.5mm)</text></svg>",
          caption: "Vết nứt tường phòng khách",
          watermark: "GPS: 10.796510, 106.653120 | 2026-09-12 09:38:40 | TB-BH-001 | TRET - PK"
        }
      ]
    },

    {
      id: "TB-BH-002",
      houseCode: "TB-BH-002",
      ownerName: "Lê Thị Bích",
      address: "148 Trường Chinh, P.12, Q. Tân Bình",
      zoneId: "ZONE-TB01",
      status: "pending",
      flagged: true, // GPS deviation > 50m
      hardwareGps: { lat: 10.795200, lng: 106.651500 }, // User stood 160m away!
      pinGps: { lat: 10.796800, lng: 106.653500 },
      deviationMeters: 235.4,
      footprint: [
        [10.796820, 106.653450],
        [10.796840, 106.653530],
        [10.796770, 106.653550],
        [10.796750, 106.653470]
      ],
      surveyDate: "2026-09-14 08:15",
      surveyorName: "Nguyễn Văn Hùng",
      structure: {
        exterior: { condition: "Cũ, có dấu hiệu lún nhẹ", notes: "Mặt tiền 3 tầng, sân trước có vết nứt nền" },
        floors: [
          {
            name: "Tầng Trệt",
            rooms: [
              {
                name: "Phòng khách",
                components: [
                  { name: "Cột dầm giao nhau", defects: "Nứt xiên góc 45 độ, dài 60cm, rộng 2.0mm" }
                ]
              }
            ]
          }
        ]
      },
      photos: [
        {
          url: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='600' height='400' style='background:%230f172a;'><rect width='100%25' height='100%25' fill='%231e293b'/><path d='M 200 80 L 320 280' stroke='%23f59e0b' stroke-width='6' fill='none'/><text x='50%25' y='40%25' fill='%23f59e0b' font-size='18' font-family='sans-serif' text-anchor='middle'>VẾT NỨT CỘT CHỊU LỰC</text></svg>",
          caption: "Chi tiết nứt cột tầng trệt",
          watermark: "GPS: 10.795200, 106.651500 | 2026-09-14 08:17:22 | TB-BH-002 | TRET - COT"
        }
      ]
    }
  ]
};

// Global Store
let currentSurveyData = {
  houseCode: "TB-BH-003",
  ownerName: "Hoàng Minh Tâm",
  address: "156 Trường Chinh, P.12, Q. Tân Bình",
  zoneId: "ZONE-TB01",
  hardwareGps: { lat: 10.797120, lng: 106.653850 },
  pinGps: { lat: 10.797125, lng: 106.653855 },
  deviationMeters: 0.7,
  footprint: [],
  structure: {
    exterior: { condition: "Bình thường", notes: "Nhà 1 trệt 2 lầu đúc bê tông cốt thép" },
    floors: [
      {
        name: "Tầng Trệt",
        rooms: [
          {
            name: "Phòng Khách",
            components: [
              { name: "Tường trước", defects: "Có vết nứt dọc 30cm, rộng 0.8mm", hasCrack: true },
              { name: "Trần thạch cao", defects: "Bình thường", hasCrack: false }
            ]
          },
          {
            name: "Bếp & Ăn",
            components: [
              { name: "Sàn gạch men", defects: "Bình thường", hasCrack: false }
            ]
          }
        ]
      },
      {
        name: "Lầu 1",
        rooms: [
          {
            name: "Phòng Ngủ Master",
            components: [
              { name: "Tường hông tiếp giáp", defects: "Nứt chân chim nhẹ", hasCrack: true }
            ]
          }
        ]
      }
    ]
  },
  photos: []
};
