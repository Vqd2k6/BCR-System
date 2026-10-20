# QUY CHUẨN KỸ THUẬT CƠ SỞ DỮ LIỆU GIS & ĐỊNH DANH CÔNG TRÌNH METRO 2
> **Dự án:** Khảo sát Hiện trạng & Đánh giá Rủi ro Công trình Tuyến Metro Số 2 (Bến Thành – Tham Lương)  
> **Tiêu chuẩn áp dụng:** Liên danh CRLG – CRSRI – TT & Ban Quản lý Đường sắt Đô thị TP.HCM (MAUR)  
> **Hệ quản trị CSDL:** PostgreSQL 16 + PostGIS Extension (SRID 4326 / EPSG 5899)  
> **Văn bản tham chiếu:** `docs/DB_GIS.md` (Phiên bản chính thức 1.0)

---

## 1. MÔ HÌNH PHÂN ĐOẠN TUYẾN (METRO 2 SEGMENT & ZONE CLASSIFICATION)

Toàn bộ hành lang Tuyến Metro Số 2 (Giai đoạn 1: Bến Thành – Tham Lương) dài **11.04 km** được chia thành **22 Zone độc lập**, tuân theo quy luật xen kẽ giữa **Nhà Ga đào hở (`C&C`)** và **Đoạn hầm ngầm khiên đào TBM (`POR`)**, kết thúc bằng **Depot Tham Lương (`DEP`)**:

### 1.1. Bảng Ký Hiệu 4 Loại Đoạn Kết Cấu Thi Công
| Mã loại | Tên đầy đủ (English) | Ý nghĩa kỹ thuật | Phạm vi áp dụng | Vùng ảnh hưởng (ZOI) |
| :--- | :--- | :--- | :--- | :--- |
| **`C&C`** | **Cut-and-Cover** | Đào mở từ mặt đất, thi công tường vây Barrette (D-Wall), hạ mực nước ngầm | 11 Hộp Ga & Hố đào chuyển tiếp | **Buffer 50m** từ mép tường hố đào |
| **`POR`** | **Bored / Underground / Portal** | Hầm khoan tròn ngầm sâu bằng máy TBM (Tunnel Boring Machine) & Hầm dẫn Portal | 10 Đoạn hầm liên ga nối tiếp | **Buffer 35m** theo máng lún Peck |
| **`ELV`** | **Elevated** | Cầu cạn trên cao dầm U / dầm hộp BTCT đúc sẵn trên trụ móng cọc khoan nhồi | Đoạn chuyển tiếp Portal lên cầu cạn | **Buffer 20m** từ tim trụ |
| **`DEP`** | **Depot** | Khu bảo dưỡng kỹ thuật, xưởng sửa chữa toa xe, OCC mặt đất | Khu phức hợp 25.7 ha Tham Lương | **Ranh tường rào + Buffer 15m** |

---

### 1.2. Bảng Danh Mục 22 Zone Toàn Tuyến Metro 2
| Zone | Tên phân đoạn / Nhà ga | Loại đoạn | Ký hiệu mã | Lý trình ước tính (Km) | Quận hành chính |
| :---: | :--- | :---: | :---: | :---: | :--- |
| **Zone 1** | **Ga Bến Thành (S1)** & Hộp chuyển tiếp | Ga ngầm đào hở | `C&C` | Km 0+000 – Km 0+350 | Quận 1 |
| **Zone 2** | Hầm TBM: Bến Thành $\rightarrow$ Tao Đàn | Hầm ngầm khoan TBM | `POR` | Km 0+350 – Km 1+035 | Quận 1 |
| **Zone 3** | **Ga Tao Đàn (S2)** (Công viên Tao Đàn) | Ga ngầm đào hở | `C&C` | Km 1+035 – Km 1+250 | Quận 1 |
| **Zone 4** | Hầm TBM: Tao Đàn $\rightarrow$ Dân Chủ | Hầm ngầm khoan TBM | `POR` | Km 1+250 – Km 2+000 | Quận 1, Quận 3 |
| **Zone 5** | **Ga Dân Chủ (S3)** (Vòng xoay Dân Chủ) | Ga ngầm đào hở | `C&C` | Km 2+000 – Km 2+200 | Quận 3, Quận 10 |
| **Zone 6** | Hầm TBM: Dân Chủ $\rightarrow$ Hòa Hưng | Hầm ngầm khoan TBM | `POR` | Km 2+200 – Km 3+078 | Quận 3, Quận 10 |
| **Zone 7** | **Ga Hòa Hưng (S4)** (Ga Sài Gòn) | Ga ngầm đào hở | `C&C` | Km 3+078 – Km 3+280 | Quận 3, Quận 10 |
| **Zone 8** | Hầm TBM: Hòa Hưng $\rightarrow$ Lê Thị Riêng | Hầm ngầm khoan TBM | `POR` | Km 3+280 – Km 4+090 | Quận 10 |
| **Zone 9** | **Ga Lê Thị Riêng (S5)** (Công viên LTR) | Ga ngầm đào hở | `C&C` | Km 4+090 – Km 4+300 | Quận 10, Tân Bình |
| **Zone 10** | Hầm TBM: Lê Thị Riêng $\rightarrow$ Phạm Văn Hai | Hầm ngầm khoan TBM | `POR` | Km 4+300 – Km 4+808 | Tân Bình |
| **Zone 11** | **Ga Phạm Văn Hai (S6)** | Ga ngầm đào hở | `C&C` | Km 4+808 – Km 5+010 | Tân Bình |
| **Zone 12** | Hầm TBM: Phạm Văn Hai $\rightarrow$ Bảy Hiền | Hầm ngầm khoan TBM | `POR` | Km 5+010 – Km 5+500 | Tân Bình |
| **Zone 13** | **Ga Bảy Hiền (S7)** (Ngã tư Bảy Hiền) | Ga ngầm đào hở | `C&C` | Km 5+500 – Km 5+750 | Tân Bình |
| **Zone 14** | Hầm TBM: Bảy Hiền $\rightarrow$ Nguyễn Hồng Đào | Hầm ngầm khoan TBM | `POR` | Km 5+750 – Km 6+700 | Tân Bình |
| **Zone 15** | **Ga Nguyễn Hồng Đào (S8)** | Ga ngầm đào hở | `C&C` | Km 6+700 – Km 6+910 | Tân Bình |
| **Zone 16** | Hầm TBM: Nguyễn Hồng Đào $\rightarrow$ Bà Quẹo | Hầm ngầm khoan TBM | `POR` | Km 6+910 – Km 7+900 | Tân Bình, Tân Phú |
| **Zone 17** | **Ga Bà Quẹo (S9)** (Mũi Tàu Trường Chinh) | Ga ngầm đào hở | `C&C` | Km 7+900 – Km 8+120 | Tân Bình, Tân Phú |
| **Zone 18** | Hầm TBM: Bà Quẹo $\rightarrow$ Phạm Văn Bạch | Hầm ngầm khoan TBM | `POR` | Km 8+120 – Km 9+050 | Tân Bình, Tân Phú, Q.12 |
| **Zone 19** | **Ga Phạm Văn Bạch (S10)** | Ga ngầm đào hở | `C&C` | Km 9+050 – Km 9+260 | Tân Bình, Quận 12 |
| **Zone 20** | Hầm TBM & Cửa hầm Portal: S10 $\rightarrow$ S11 | Hầm TBM & Portal | `POR` | Km 9+260 – Km 10+100 | Quận 12 |
| **Zone 21** | **Ga Tân Bình (S11)** | Ga ngầm / chuyển tiếp | `C&C` | Km 10+100 – Km 10+320 | Quận 12 |
| **Zone 22** | **Depot Tham Lương** (Khu bảo dưỡng) | Khu phức hợp kỹ thuật | `DEP` | Km 10+320 – Km 11+040 | Tân Thới Nhất, Q.12 |

---

## 2. QUY CHUẨN ĐỊNH DANH CÔNG TRÌNH: `B-XXXXX-YYY`

### 2.1. Cấu Trúc Mã
Mọi công trình khảo sát hiện trạng (Phase 1 & Phase 2 BCS) bắt buộc mang mã định danh duy nhất theo cú pháp:

$$\mathbf{B\text{-}XXXXX\text{-}YYY}$$

```
   B  -  0 0 1 0 5  -  C & C
  [1]       [2]         [3]
```

- **`[1] B-`**: Tiền tố cố định viết tắt của **Building** (Công trình / Thửa đất khảo sát).
- **`[2] XXXXX`**: Số thứ tự tăng dần gồm đúng **5 chữ số** (`padZero(n, 5)`: `00001` đến `99999`).
  - **Quy tắc nhảy số:** Số thứ tự `XXXXX` **nhảy số liên tục toàn tuyến** theo trình tự nạp dữ liệu từ Ga Bến Thành (Km 0+000) về Depot Tham Lương (Km 11+040).
  - Không khởi tạo lại từ 1 khi sang Zone mới.
- **`[3] YYY`**: Hậu tố phân loại kết cấu thi công phân đoạn, nhận 1 trong 4 giá trị:
  - `C&C` (Đoạn ga đào hở)
  - `POR` (Đoạn hầm ngầm khoan TBM / Portal)
  - `ELV` (Đoạn trên cao)
  - `DEP` (Khu Depot Tham Lương)

### 2.2. Ví dụ Minh họa
- Thửa đất số 1 thuộc Zone 1 (Bến Thành): `B-00001-C&C`
- Thửa đất số 302 thuộc Zone 1: `B-00302-C&C`
- Thửa đất đầu tiên thuộc Zone 2 (Hầm TBM Bến Thành - Tao Đàn): `B-00303-POR`
- Thửa đất đầu tiên thuộc Zone 3 (Ga Tao Đàn): `B-00465-C&C`
- Thửa đất trong Khu Depot Tham Lương: `B-01580-DEP`

### 2.3. Xử lý Kỹ thuật Ký tự `&` trong Tầng Ứng dụng & REST API
Do hậu tố chứa ký tự `&` (`C&C`), để tránh lỗi ngắt tham số query trên HTTP URL:
- **Tầng Database:** Cột `project_parcel_code VARCHAR(32)` lưu nguyên bản `B-00001-C&C`.
- **Tầng Index / Slug (khuyên dùng):** Cột `code_slug VARCHAR(32)` lưu `B-00001-CC` phục vụ tìm kiếm nhanh không phân biệt ký tự đặc biệt.
- **Tầng REST API Route:** Khi truyền qua URL params, client encode an toàn: `encodeURIComponent('B-00001-C&C')` $\rightarrow$ `B-00001-C%26C` hoặc tìm kiếm qua body `POST /parcels/find-by-code`.

---

## 3. QUY TẮC PHÂN BỔ ZONE & KHỬ TRÙNG LẶP RANH GIỚI (BOUNDARY DEDUPLICATION)

### 3.1. Nguyên Tắc Sở Hữu Zone Đầu Tiên (First-Come, First-Served Ownership Rule)
> **Nguyên tắc cốt lõi theo chỉ đạo dự án:**  
> **"Chưa tồn tại thì nó là của Zone đó; nếu đã tồn tại thì vẫn thuộc ô đầu tiên để tránh khảo sát hết Zone 1 xong nó lại bị nhảy sang lô 2."**

```
              ┌──────────────────────────────────────────────┐
              │  NẠP LÔ ĐẤT MỚI TỪ FILE CÀO CỦA ZONE K      │
              │  (Trích xuất mathuadat từ ban_do_data.json)  │
              └──────────────────────┬───────────────────────┘
                                     │
                                     ▼
                      ┌─────────────────────────────┐
                      │  Đã tồn tại mathuadat trong │
                      │  CSDL (Zone trước đó)?      │
                      └──────┬───────────────┬──────┘
                             │               │
                        Có (TRUE)       Không (FALSE)
                             │               │
                             ▼               ▼
         ┌─────────────────────────┐  ┌─────────────────────────────────┐
         │       BỎ QUA (SKIP)     │  │          NẠP VÀO CSDL           │
         │ - Giữ nguyên Zone đầu   │  │ - Gán zone_id = Zone K          │
         │ - Giữ nguyên mã B-XXXXX │  │ - Cấp số thứ tự XXXXX tiếp theo │
         │ - Bảo toàn khảo sát cũ  │  │ - Mã: B-XXXXX-[YYY của Zone K]  │
         └─────────────────────────┘  └─────────────────────────────────┘
```

**Lý do kỹ thuật & nghiệp vụ:**
1. **Bảo toàn hồ sơ hiện trường:** Kỹ sư đã đi thực địa khảo sát lô đất ở Zone 1, chụp ảnh nứt nẻ, lập biên bản, chủ nhà đã ký xác nhận. Nếu khi nạp Zone 2 mà lô đất đó bị ghi đè thành Zone 2 (`B-YYYYY-POR`) thì toàn bộ liên kết pháp lý và mã biên bản sẽ bị phá vỡ.
2. **Loại trừ sai số cào ranh buffer:** Lúc cào dữ liệu GIS theo bounding box hoặc polygon buffer, các lô đất nằm trên đường phân giới giữa 2 ga/hầm luôn bị chồng lấn. Quy tắc này đảm bảo mỗi lô đất chỉ tồn tại duy nhất một lần trên toàn hệ thống.

### 3.2. Khóa Định Danh Pháp Lý Chống Trùng (Natural Unique Key)
Hệ thống sử dụng trường `mathuadat` trích xuất từ dữ liệu địa chính Sở TNMT / SQHKT (chuỗi 12 ký tự số, ví dụ: `267490070038`) làm khóa chống trùng tuyệt đối:
- Cột cơ sở dữ liệu: `parcels.official_cadastral_code = mathuadat` (Có ràng buộc `UNIQUE`).
- Khi chạy ETL nạp dữ liệu cho Zone $k$:
  ```sql
  INSERT INTO parcels (
      zone_id,
      segment_type,
      project_parcel_code,
      code_slug,
      official_cadastral_code,
      ...
  )
  VALUES (...)
  ON CONFLICT (official_cadastral_code) DO NOTHING;
  ```
  Nếu lô đất đã có trong CSDL $\rightarrow$ Lệnh INSERT tự động bỏ qua, không cấp thêm mã `B-XXXXX` mới, không làm gián đoạn số đếm.

---

## 4. QUY CHUẨN NỀN GIS CƠ SỞ (GIS BASELINE STANDARDS)

### 4.1. Hệ Quy Chiếu Tọa Độ (CRS & Projections)
| Lớp dữ liệu | Hệ quy chiếu | Mã EPSG | Mục đích sử dụng |
| :--- | :--- | :--- | :--- |
| **WebGIS / Mobile App / Leaflet** | **WGS-84** (Độ thập phân) | `EPSG:4326` | Hiển thị bản đồ vệ tinh, GPS di động, GeoJSON, Leaflet Map |
| **Trắc địa / Tính diện tích / Khoảng cách** | **VN-2000 TP.HCM** (KTT: 105°45', Múi 3°) | `EPSG:5899` | Tính toán diện tích $S_{\text{đất}}\text{ m}^2$, chiều sâu hố đào, khoảng cách vuông góc tim tuyến |

*Cách tính diện tích chuẩn pháp lý milimet trong PostGIS:*
```sql
-- Chuyển đổi sang VN-2000 TP.HCM để tính diện tích m2 mặt đất thực
SELECT ST_Area(ST_Transform(cadastral_polygon_geom, 5899)) AS legal_area_m2
FROM parcels WHERE id = $1;
```

### 4.2. Định Dạng Hình Học Lô Đất (Geometry Fields)
Mỗi bản ghi trong bảng `parcels` sở hữu 3 trường không gian:
1. `location_geom GEOMETRY(Point, 4326)`: Điểm tâm (Centroid) hoặc đỉnh ranh đất gần tim Metro nhất.
2. `cadastral_polygon_geom GEOMETRY(Polygon, 4326)`: Đa giác khép kín ranh thửa đất địa chính SQHKT.
3. `footprint_polygon_geom GEOMETRY(Polygon, 4326)`: Đa giác vết chân nhà / công trình xây dựng thực tế.
   - *Lúc nạp ban đầu:* Mặc định khởi tạo đồng nhất với `cadastral_polygon_geom`.
   - *Lúc khảo sát thực địa:* Kỹ sư sử dụng công cụ vẽ trên app để căn chỉnh vết chân nhà thực tế (Bước 1.3 / Bước 5).

### 4.3. Ràng Buộc Topology Đa Giác
- Mọi Polygon ranh đất bắt buộc phải là **Closed Ring** (`coords[0] === coords[coords.length - 1]`).
- Tự động chuẩn hóa bằng `ST_MakeValid(...)` khi nạp từ file JSON để triệt tiêu lỗi tự cắt (self-intersection).

---

## 5. CẤU TRÚC BẢNG CƠ SỞ DỮ LIỆU POSTGIS

### 5.1. Bảng Phân Đoạn Tuyến: `metro_segments`
```sql
CREATE TYPE metro_construction_type_enum AS ENUM (
    'C&C',   -- Cut-and-Cover (Ga đào hở / Hố đào chuyển tiếp)
    'POR',   -- Bored TBM / Portal (Hầm khoan khiên đào ngầm)
    'ELV',   -- Elevated (Đoạn cầu cạn trên cao)
    'DEP'    -- Depot (Khu bảo dưỡng kỹ thuật Tham Lương)
);

CREATE TABLE metro_segments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    zone_index INT UNIQUE NOT NULL,                -- 1 đến 22
    segment_code VARCHAR(32) UNIQUE NOT NULL,      -- VD: 'ZONE_01', 'ZONE_02'
    segment_name VARCHAR(128) NOT NULL,             -- VD: 'Ga S1 Bến Thành (C&C)'
    construction_type metro_construction_type_enum NOT NULL,
    start_chainage_km VARCHAR(16),                 -- VD: 'Km 0+000'
    end_chainage_km VARCHAR(16),                   -- VD: 'Km 0+350'
    zoi_buffer_meters NUMERIC(6,2) NOT NULL DEFAULT 50.0,
    centerline_geom GEOMETRY(LineString, 4326),
    zoi_polygon_geom GEOMETRY(Polygon, 4326),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_metro_segments_zone ON metro_segments(zone_index);
CREATE INDEX idx_metro_segments_type ON metro_segments(construction_type);
CREATE INDEX idx_metro_segments_zoi ON metro_segments USING GIST(zoi_polygon_geom);
```

### 5.2. Bảng Thửa Đất Địa Chính: `parcels`
```sql
CREATE TABLE parcels (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    zone_id VARCHAR(32) NOT NULL,                  -- 'ZONE_01', 'ZONE_02', ...
    segment_type metro_construction_type_enum NOT NULL, -- 'C&C' | 'POR' | 'ELV' | 'DEP'
    project_parcel_code VARCHAR(32) UNIQUE NOT NULL, -- 'B-00105-C&C', 'B-00305-POR'
    code_slug VARCHAR(32),                         -- 'B-00105-CC' (URL-friendly)
    official_cadastral_code VARCHAR(64) UNIQUE,    -- mathuadat SQHKT: '267490070038'
    land_plot_number VARCHAR(32),                  -- sothua (Số thửa)
    map_sheet_number VARCHAR(32),                  -- soto (Số tờ)
    house_number VARCHAR(64),
    street VARCHAR(128),
    ward VARCHAR(64),
    district VARCHAR(64),
    owner_name VARCHAR(128),
    owner_phone VARCHAR(32),
    land_area_m2 NUMERIC(10,2),
    construction_area_m2 NUMERIC(10,2),
    floor_count INT NOT NULL DEFAULT 1,
    building_type VARCHAR(32) NOT NULL DEFAULT 'STANDALONE', -- 'STANDALONE' | 'CONDOMINIUM' | 'ROW_HOUSE'
    total_units INT NOT NULL DEFAULT 1,
    survey_status VARCHAR(32) NOT NULL DEFAULT 'NOT_SURVEYED',
    lifecycle_status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
    location_geom GEOMETRY(Point, 4326),
    cadastral_polygon_geom GEOMETRY(Polygon, 4326) NOT NULL,
    footprint_polygon_geom GEOMETRY(Polygon, 4326),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_parcels_project_code ON parcels(project_parcel_code);
CREATE INDEX idx_parcels_cadastral_code ON parcels(official_cadastral_code);
CREATE INDEX idx_parcels_zone ON parcels(zone_id);
CREATE INDEX idx_parcels_segment_type ON parcels(segment_type);
CREATE INDEX idx_parcels_status ON parcels(survey_status);
CREATE INDEX idx_parcels_location ON parcels USING GIST(location_geom);
CREATE INDEX idx_parcels_cadastral ON parcels USING GIST(cadastral_polygon_geom);
CREATE INDEX idx_parcels_footprint ON parcels USING GIST(footprint_polygon_geom);
```

---

## 6. QUY TRÌNH NẠP DỮ LIỆU THỰC TẾ 5 ZONE HIỆN CÓ (ETL WORKFLOW)

Hiện tại trong thư mục `data/` đang có dữ liệu của 5 Zone:
1. `data/Zone_01/ban_do_data.json`: Zone 1 (`C&C`) – 302 thửa thô
2. `data/Zone_02/ban_do_data.json`: Zone 2 (`POR`) – 162 thửa thô
3. `data/Zone_03/ban_do_data.json`: Zone 3 (`C&C`) – 143 thửa thô
4. `data/Zone_04/ban_do_data.json`: Zone 4 (`POR`) – 452 thửa thô
5. `data/Zone_09/ban_do_data.json`: Zone 9 (`C&C`) – 192 thửa thô

**Trình tự nạp khuyến nghị:**
1. Nạp `Zone_01` (khởi tạo từ `B-00001-C&C`)
2. Nạp `Zone_02` (khử các thửa giáp ranh đã có ở Zone 1, nhảy số tiếp nối dạng `B-XXXXX-POR`)
3. Nạp `Zone_03` (khử các thửa giáp ranh đã có ở Zone 2, nhảy số tiếp nối dạng `B-XXXXX-C&C`)
4. Nạp `Zone_04` (khử các thửa giáp ranh đã có ở Zone 3, nhảy số tiếp nối dạng `B-XXXXX-POR`)
5. Nạp `Zone_09` (khử các thửa giáp ranh nếu có, nhảy số tiếp nối dạng `B-XXXXX-C&C`)

### 6.1. Logic Thực Thi của Kịch Bản Nạp Tuần Tự (`seed_baseline_zones.ts`)
```typescript
/**
 * Thuật toán sinh mã và nạp an toàn tuân thủ quy tắc First-Come, First-Served
 */
async function importZone(zoneFolder: string, zoneId: string, segmentType: 'C&C' | 'POR' | 'ELV' | 'DEP') {
  const data = JSON.parse(fs.readFileSync(`data/${zoneFolder}/ban_do_data.json`, 'utf8'));
  const rawParcels = Object.values(data.parcels || {});

  // 1. Lấy số thứ tự lớn nhất hiện có trong DB toàn tuyến
  const maxRes = await client.query(`
    SELECT COALESCE(MAX(SUBSTRING(project_parcel_code FROM 3 FOR 5)::INT), 0) AS max_seq
    FROM parcels;
  `);
  let currentSeq = maxRes.rows[0].max_seq;

  let insertedCount = 0;
  let skippedCount = 0;

  for (const p of rawParcels) {
    const mathuadat = p.mathuadat;
    if (!mathuadat) continue;
    
    // 2. Kiểm tra tồn tại theo nguyên tắc First-Come, First-Served
    const existCheck = await client.query(
      `SELECT id, project_parcel_code, zone_id FROM parcels WHERE official_cadastral_code = $1 LIMIT 1;`,
      [String(mathuadat)]
    );

    if (existCheck.rows.length > 0) {
      console.log(`[SKIP] Thửa ${mathuadat} đã thuộc ${existCheck.rows[0].zone_id} (${existCheck.rows[0].project_parcel_code}). Giữ nguyên.`);
      skippedCount++;
      continue; // Bỏ qua không nạp lại vào Zone mới
    }

    // 3. Cấp mã số thứ tự tiếp theo (nhảy số liên tục)
    currentSeq++;
    const seqStr = String(currentSeq).padStart(5, '0');
    const projectParcelCode = `B-${seqStr}-${segmentType}`;
    const codeSlug = `B-${seqStr}-${segmentType.replace('&', '')}`;

    // 4. Tạo Polygon PostGIS và chèn vào DB
    // ...
    insertedCount++;
  }

  console.log(`Hoàn thành ${zoneId}: Nạp mới ${insertedCount}, Bỏ qua trùng lặp ${skippedCount}`);
}
```

---

## 7. KẾ HOẠCH NÂNG CẤP & MỞ RỘNG TIẾP THEO

1. **Giai đoạn 1 (Hiện tại):** Nạp hoàn chỉnh 5 Zone ban đầu (Zone 1, 2, 3, 4, 9), kích hoạt hiển thị và kiểm tra trên `LeafletSweepMap`.
2. **Giai đoạn 2:** Khi cào xong các Zone còn lại (Zone 5, 6, 7, 8, 10 $\rightarrow$ 22), chỉ cần kích hoạt script ETL trỏ vào thư mục Zone mới. Bộ đếm `XXXXX` sẽ tự động nối đuôi liên tục và tự động khử các thửa chồng lấn mà không cần cấu hình lại hệ thống.
3. **Giai đoạn 3:** Liên kết mã `B-XXXXX-YYY` vào hệ thống xuất báo cáo Puppeteer/HTML-to-PDF (Phase 1 BCS Report) theo đúng mẫu Phiếu 01 của liên danh CRLG-CRSRI-TT.
