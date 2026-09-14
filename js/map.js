/**
 * LEAFLET GIS MAP ENGINE FOR WEB ADMIN & MOBILE SIMULATOR
 * TÍCH HỢP 160 ĐƯỜNG BAO METRO GỐC + 6.431 THỬA ĐẤT KS003 + ĐIỀU KHIỂN ẨN/HIỆN LỚP ĐA CẤP
 */

let adminMap = null;
let mobileGpsMap = null;
let mobileFootprintMap = null;

// Base Tile Layers for Admin Map
let baseLayers = {
  esriSatellite: null,
  googleSatellite: null,
  osmStreet: null
};

// Admin Feature Layers
let adminLayers = {
  metroCorridorLines: null,   // 2 đường bao ranh GPMB Tả & Hữu CAD gốc
  metroStationBoxes: null,    // Ranh các hộp ga Metro ST01 -> ST11
  metroStations: null,        // 11 Nhà ga Metro chính thức
  metroBuffer50m: null,       // Vùng đệm hành lang khảo sát 50m
  ks003Parcels: null,         // 6.431 Thửa đất quy hoạch KS003
  zones: null,                // Phân vùng khảo sát 1-12
  buildings: null,            // Dấu chân công trình thực tế đã khảo sát
  highlight: null             // Vùng sáng highlight khi tìm kiếm
};

// Mobile Feature Layers
let mobileLayers = {
  parcels: null,
  metroBoundaries: null,
  gpsMarkerHw: null,
  gpsMarkerPin: null,
  connLine: null,
  satelliteTile: null,
  streetTile: null
};

let ks003ParcelsData = null;
let ks003ParcelsCount = 0;
let ks003ParcelsPolygons = [];
let currentParcelFilter = 'ALL'; // ALL | RESIDENTIAL | BUILDING | TRANSPORT
let currentOpacity = 0.45;
let isParcelsLoaded = false;
let canvasRenderer = null;
let mobileCanvasRenderer = null;

// Haversine Distance Calculation (Meters)
function calculateDistanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // metres
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

// ----------------------------------------------------------------------------
// 1. INITIALIZE WEB ADMIN GIS MAP
// ----------------------------------------------------------------------------
function initAdminMap() {
  const container = document.getElementById('admin-map');
  if (!container || adminMap) return;

  // Center around Bay Hien Interchange (Central hub of Metro Line 2)
  adminMap = L.map('admin-map', {
    preferCanvas: true,
    zoomControl: false // Custom placement below
  }).setView([10.7965, 106.6540], 16);

  // Position Zoom Control top-right
  L.control.zoom({ position: 'topright' }).addTo(adminMap);

  // High-performance Canvas Renderer for Parcels & Boundaries
  canvasRenderer = L.canvas({ padding: 0.5 });

  // Custom Panes for strict Z-Index visual layering
  adminMap.createPane('parcelsPane');
  adminMap.getPane('parcelsPane').style.zIndex = '350';

  adminMap.createPane('metroBoundaryPane');
  adminMap.getPane('metroBoundaryPane').style.zIndex = '400';

  adminMap.createPane('stationsPane');
  adminMap.getPane('stationsPane').style.zIndex = '450';

  adminMap.createPane('buildingsPane');
  adminMap.getPane('buildingsPane').style.zIndex = '500';

  // Define Base Tile Layers
  baseLayers.esriSatellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 20,
    attribution: '© Esri World Imagery'
  });

  baseLayers.googleSatellite = L.tileLayer('https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
    maxZoom: 20,
    attribution: '© Google Satellite'
  });

  baseLayers.osmStreet = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 20,
    attribution: '© OpenStreetMap'
  });

  // Default basemap: Esri World Imagery
  baseLayers.esriSatellite.addTo(adminMap);

  // Initialize Layer Groups
  adminLayers.metroCorridorLines = L.featureGroup({ pane: 'metroBoundaryPane' }).addTo(adminMap);
  adminLayers.metroStationBoxes = L.featureGroup({ pane: 'metroBoundaryPane' }).addTo(adminMap);
  adminLayers.metroStations = L.featureGroup({ pane: 'stationsPane' }).addTo(adminMap);
  adminLayers.metroBuffer50m = L.featureGroup({ pane: 'metroBoundaryPane' }).addTo(adminMap);
  adminLayers.ks003Parcels = L.featureGroup({ pane: 'parcelsPane' }).addTo(adminMap);
  adminLayers.zones = L.featureGroup({ pane: 'metroBoundaryPane' }).addTo(adminMap);
  adminLayers.buildings = L.featureGroup({ pane: 'buildingsPane' }).addTo(adminMap);
  adminLayers.highlight = L.featureGroup().addTo(adminMap);

  // Render all map features
  renderOfficialMetroLine2();
  renderSurveyZones();
  renderBuildingsOnAdminMap();
  loadKS003ParcelsData();

  // Setup live cursor coordinate display
  adminMap.on('mousemove', (e) => {
    const coordEl = document.getElementById('map-cursor-coords');
    if (coordEl) {
      coordEl.innerText = `${e.latlng.lat.toFixed(6)}, ${e.latlng.lng.toFixed(6)} (Zoom: ${adminMap.getZoom()})`;
    }
  });
}

// ----------------------------------------------------------------------------
// 2. RENDER OFFICIAL METRO LINE 2 CAD/GIS BOUNDARIES & 11 STATIONS (UNIFIED)
// ----------------------------------------------------------------------------
function renderOfficialMetroLine2() {
  if (!adminMap) return;

  adminLayers.metroCorridorLines.clearLayers();
  adminLayers.metroStationBoxes.clearLayers();
  adminLayers.metroStations.clearLayers();

  const source = (typeof METRO_LINE2_OFFICIAL !== 'undefined') ? METRO_LINE2_OFFICIAL : null;
  if (!source) return;

  // 1. Draw Official Left & Right CAD Clearance Boundaries (Ranh Giải Phóng Mặt Bằng Tả & Hữu Tuyến)
  if (source.corridorBoundaries && source.corridorBoundaries.length > 0) {
    source.corridorBoundaries.forEach((line, idx) => {
      // Glow underlay
      L.polyline(line.coords, {
        color: 'rgba(220, 38, 38, 0.2)',
        weight: 6,
        renderer: canvasRenderer
      }).addTo(adminLayers.metroCorridorLines);

      // Sharp Red CAD Boundary Line
      L.polyline(line.coords, {
        color: '#dc2626',
        weight: 3,
        opacity: 0.95,
        dashArray: '8, 4',
        renderer: canvasRenderer
      }).addTo(adminLayers.metroCorridorLines).bindTooltip(`🚇 ${line.name || 'Ranh giải phóng mặt bằng Tuyến Metro 2 (CAD MAUR)'}`, { sticky: true });
    });
  }

  // 2. Draw 11 Station Clearance Boxes (11 Hộp ga Metro ST01 - ST11 đồng nhất)
  if (source.stationPolygons && source.stationPolygons.length > 0) {
    source.stationPolygons.forEach((box, idx) => {
      L.polygon(box.coords, {
        color: '#0284c7',
        weight: 2.5,
        fillColor: '#38bdf8',
        fillOpacity: 0.35,
        renderer: canvasRenderer
      }).addTo(adminLayers.metroStationBoxes).bindTooltip(`🚉 Ranh ga Metro: ${box.name || `Ga ST${idx+1 < 10 ? '0' : ''}${idx+1}`}`, { sticky: true });
    });
  }

  // 3. Draw 11 Official Metro Stations (ST01 - ST11) with unified blue styling
  const stationsList = source.stations || [];
  stationsList.forEach((st, idx) => {
    const badgeBg = '#0284c7';
    const icon = L.divIcon({
      className: 'custom-station-icon',
      html: `
        <div style="background:${badgeBg}; color:#fff; font-size:10px; font-weight:700; padding:3px 8px; border-radius:12px; border:1.5px solid #fff; box-shadow:0 3px 10px rgba(0,0,0,0.35); white-space:nowrap; display:flex; align-items:center; gap:4px; cursor:pointer;">
          <span>🚉</span>
          <span>${st.code}: ${st.name.replace(/\\(ST\\d+\\)/, '').trim()}</span>
        </div>
      `,
      iconSize: [160, 24],
      iconAnchor: [80, 12]
    });

    const marker = L.marker(st.pos, { icon }).addTo(adminLayers.metroStations);
    
    marker.bindPopup(`
      <div style="font-size:12px; line-height:1.5; min-width:240px; color:#0f172a;">
        <div style="font-size:14px; font-weight:700; color:${badgeBg}; border-bottom:2px solid #e2e8f0; padding-bottom:4px; margin-bottom:6px;">
          ${st.name}
        </div>
        <div>• <b>Mã ga:</b> <code style="color:${badgeBg}; font-weight:700;">${st.code}</code> (${st.km || 'KM0+000'})</div>
        <div>• <b>Quy mô:</b> ${st.type}</div>
        <div style="margin-top:6px; font-size:11px; color:#64748b; background:#f8fafc; padding:6px; border-radius:4px; border-left:3px solid ${badgeBg};">
          ${st.desc || 'Thuộc dự án tuyến Metro Số 2 (Bến Thành – Tham Lương)'}
        </div>
        <button onclick="if(adminMap) adminMap.flyTo([${st.pos[0]}, ${st.pos[1]}], 18);" style="margin-top:8px; width:100%; padding:5px; background:${badgeBg}; color:#fff; border:none; border-radius:4px; font-weight:700; cursor:pointer;">
          🎯 Zoom Cận Cảnh Ga Này
        </button>
      </div>
    `);
  });
}

// Toggle Left Sidebar with map resize invalidation
window.toggleLeftSidebar = function() {
  const sidebar = document.getElementById('admin-left-sidebar');
  const btn = document.getElementById('btn-toggle-sidebar');
  if (!sidebar) return;
  sidebar.classList.toggle('collapsed');
  const isCollapsed = sidebar.classList.contains('collapsed');
  if (btn) {
    btn.innerHTML = isCollapsed ? '<span>▶</span> <span>Mở Menu Điều Khiển</span>' : '<span>◀</span> <span>Thu Gọn Menu</span>';
  }
  setTimeout(() => {
    if (adminMap) adminMap.invalidateSize();
  }, 320);
};

// ----------------------------------------------------------------------------
// 3. LOAD & RENDER 6,431 KS003 PARCELS WITH CATEGORY FILTERS & OPACITY
// ----------------------------------------------------------------------------
async function loadKS003ParcelsData(filterType = 'ALL') {
  currentParcelFilter = filterType;
  const statusBadge = document.getElementById('parcels-load-status');
  if (statusBadge) statusBadge.innerText = 'Đang nạp 6.431 thửa...';

  try {
    if (!ks003ParcelsData) {
      const response = await fetch('data/KS003/ban_do_data.json');
      if (!response.ok) throw new Error('Cannot load ban_do_data.json');
      const data = await response.json();
      ks003ParcelsData = data.parcels || {};
    }

    renderFilteredParcels();

    const countEl = document.getElementById('stat-ks003-parcels-count');
    if (countEl) countEl.innerText = Object.keys(ks003ParcelsData).length.toLocaleString();

    if (statusBadge) statusBadge.innerText = `✅ Đã nạp ${Object.keys(ks003ParcelsData).length.toLocaleString()} thửa`;
    isParcelsLoaded = true;

    // Also populate mobile map layers if initialized
    if (mobileGpsMap) renderMobileParcelsAndBoundaries();
  } catch (err) {
    console.warn('Lỗi khi nạp dữ liệu thửa đất KS003:', err);
    if (statusBadge) statusBadge.innerText = 'Dữ liệu mẫu';
  }
}

// Render parcels according to selected filter (ALL, RESIDENTIAL, BUILDING, TRANSPORT)
function renderFilteredParcels() {
  if (!adminMap || !ks003ParcelsData) return;
  adminLayers.ks003Parcels.clearLayers();
  ks003ParcelsPolygons = [];

  const pKeys = Object.keys(ks003ParcelsData);
  let renderedCount = 0;

  pKeys.forEach(k => {
    const p = ks003ParcelsData[k];
    if (!p.ranh_coords || p.ranh_coords.length < 3) return;

    // Determine parcel characteristics
    const hasResidential = p.chucnang_summary && (p.chucnang_summary.includes('Đất ở') || p.chucnang_summary.includes('Dân cư'));
    const hasBuilding = p.chucnang_summary && (p.chucnang_summary.includes('công trình') || p.chucnang_summary.includes('thương mại') || p.chucnang_summary.includes('phức hợp') || p.chucnang_summary.includes('hỗn hợp') || p.chucnang_summary.includes('giáo dục') || p.chucnang_summary.includes('y tế') || p.chucnang_summary.includes('Ga Depot'));
    const hasTransport = p.logioi_summary || (p.chucnang_summary && p.chucnang_summary.includes('giao thông'));

    // Apply Filter Logic
    if (currentParcelFilter === 'RESIDENTIAL' && !hasResidential) return;
    if (currentParcelFilter === 'BUILDING' && !hasBuilding) return;
    if (currentParcelFilter === 'TRANSPORT' && !hasTransport) return;

    // Color code according to primary function
    let strokeColor = '#ea580c';
    let fillColor = '#fb923c';

    if (hasBuilding) {
      strokeColor = '#0284c7';
      fillColor = '#38bdf8';
    } else if (hasResidential) {
      strokeColor = '#ea580c';
      fillColor = '#fb923c';
    } else if (hasTransport) {
      strokeColor = '#dc2626';
      fillColor = '#f87171';
    }

    const poly = L.polygon(p.ranh_coords, {
      color: strokeColor,
      weight: 1.2,
      fillColor: fillColor,
      fillOpacity: currentOpacity,
      renderer: canvasRenderer
    }).addTo(adminLayers.ks003Parcels);

    poly.parcelInfo = p;
    ks003ParcelsPolygons.push(poly);
    renderedCount++;

    // Tooltip
    poly.bindTooltip(`Thửa ${p.sothua} / Tờ ${p.soto} (${p.dientich_formatted || p.dientich} m²)`, {
      sticky: true,
      direction: 'top'
    });

    // Hover Highlight
    poly.on('mouseover', () => {
      poly.setStyle({ weight: 3, fillOpacity: Math.min(1.0, currentOpacity + 0.3), color: '#ffffff' });
    });
    poly.on('mouseout', () => {
      poly.setStyle({ weight: 1.2, fillOpacity: currentOpacity, color: strokeColor });
    });

    // Detailed Popup
    poly.bindPopup(`
      <div style="font-size:12px; line-height:1.5; max-width:320px; color:#0f172a;">
        <div style="font-size:14px; font-weight:700; color:#ea580c; border-bottom:2px solid #fed7aa; padding-bottom:4px; margin-bottom:6px; display:flex; justify-content:space-between;">
          <span>🏢 Thửa: ${p.sothua} / Tờ: ${p.soto}</span>
          <span style="font-size:11px; background:#ffedd5; color:#9a3412; padding:1px 6px; border-radius:4px;">${p.tenquanhuyen || 'Tân Bình'}</span>
        </div>
        <div>• <b>Địa chỉ:</b> ${p.tenphuongxa}, ${p.tenquanhuyen}</div>
        <div>• <b>Diện tích:</b> <b style="color:#ea580c;">${p.dientich_formatted || p.dientich} m²</b></div>
        <div>• <b>Mã thửa SQHKT:</b> <code style="font-family:'JetBrains Mono'; font-size:11px;">${p.mathuadat}</code></div>
        <div style="margin-top:6px; background:#fff7ed; padding:6px 8px; border-radius:4px; border-left:3px solid #f97316; font-size:11px; color:#9a3412;">
          <b>Quy hoạch 1/2000:</b><br/>${p.tendoan || 'Đồ án phân khu đô thị hiện hữu'}
        </div>
        ${p.chucnang_summary ? `<div style="margin-top:4px; font-size:10.5px; color:#475569;"><b>Chức năng:</b> ${p.chucnang_summary.split('\n')[0]}</div>` : ''}
        ${p.logioi_summary ? `<div style="margin-top:4px; font-size:10.5px; color:#dc2626;"><b>Lộ giới:</b> ${p.logioi_summary}</div>` : ''}
        <button onclick="startSurveyForParcel('${p.mathuadat}', '${p.sothua}', '${p.soto}', '${p.tenphuongxa}', '${p.tenquanhuyen}', ${p.ranh_coords[0][0]}, ${p.ranh_coords[0][1]})" style="margin-top:8px; width:100%; padding:7px; background:#0284c7; color:#fff; border:none; border-radius:6px; font-weight:700; cursor:pointer; font-size:12px; display:flex; align-items:center; justify-content:center; gap:6px;">
          <span>📍</span> <span>Bắt Đầu Khảo Sát Căn Nhà Tại Thửa Này</span>
        </button>
      </div>
    `);
  });

  const filterCountEl = document.getElementById('current-filter-count');
  if (filterCountEl) filterCountEl.innerText = `${renderedCount.toLocaleString()} thửa`;
}

// Set Layer Opacity Slider (10% to 100%)
window.setParcelsOpacity = function(val) {
  currentOpacity = parseFloat(val);
  const label = document.getElementById('opacity-val-label');
  if (label) label.innerText = `${Math.round(currentOpacity * 100)}%`;

  ks003ParcelsPolygons.forEach(poly => {
    poly.setStyle({ fillOpacity: currentOpacity });
  });
};

// Filter Parcels by Type (ALL, RESIDENTIAL, BUILDING, TRANSPORT)
window.filterParcelsByCategory = function(category, btnElement) {
  currentParcelFilter = category;
  document.querySelectorAll('.filter-pill').forEach(el => el.classList.remove('active'));
  if (btnElement) btnElement.classList.add('active');
  renderFilteredParcels();
  showToast(`Đã lọc hiển thị: ${category === 'ALL' ? 'Tất cả 6.431 thửa' : category === 'RESIDENTIAL' ? 'Thửa có nhà ở / dân cư' : category === 'BUILDING' ? 'Thửa có công trình xây dựng' : 'Thửa tiếp giáp lộ giới'}`, 'info');
};

// ----------------------------------------------------------------------------
// 4. SPATIAL QUICK SEARCH (SEARCH BY PARCEL / SHEET / STATION / STREET)
// ----------------------------------------------------------------------------
window.searchMapLocation = function(keyword) {
  if (!keyword || !keyword.trim()) {
    showToast('Vui lòng nhập từ khóa tìm kiếm (Số thửa, Tên ga, hoặc Tên đường)', 'warning');
    return;
  }

  const q = keyword.trim().toLowerCase();
  adminLayers.highlight.clearLayers();

  // 1. Check Stations first
  const source = (typeof METRO_LINE2_OFFICIAL !== 'undefined') ? METRO_LINE2_OFFICIAL : null;
  if (source && source.stations) {
    const matchedStation = source.stations.find(s => 
      s.code.toLowerCase().includes(q) || 
      s.name.toLowerCase().includes(q)
    );
    if (matchedStation) {
      adminMap.flyTo(matchedStation.pos, 18, { animate: true, duration: 1.2 });
      L.circleMarker(matchedStation.pos, {
        radius: 35,
        color: '#ef4444',
        weight: 3,
        fillColor: '#f87171',
        fillOpacity: 0.35
      }).addTo(adminLayers.highlight);
      showToast(`🎯 Đã định vị đến ${matchedStation.name}`, 'success');
      return;
    }
  }

  // 2. Check Cadastral Parcels (sothua, soto, mathuadat, address)
  if (ks003ParcelsData) {
    const pKeys = Object.keys(ks003ParcelsData);
    let matchedParcel = null;

    for (let i = 0; i < pKeys.length; i++) {
      const p = ks003ParcelsData[pKeys[i]];
      if (
        p.sothua == q || 
        `thửa ${p.sothua}`.toLowerCase() == q ||
        (p.mathuadat && p.mathuadat.toLowerCase().includes(q)) ||
        (p.tenphuongxa && p.tenphuongxa.toLowerCase().includes(q) && q.length > 5) ||
        (p.logioi_summary && p.logioi_summary.toLowerCase().includes(q))
      ) {
        matchedParcel = p;
        break;
      }
    }

    if (matchedParcel && matchedParcel.ranh_coords && matchedParcel.ranh_coords.length > 0) {
      const center = matchedParcel.ranh_coords[0];
      adminMap.flyTo([center[0], center[1]], 19, { animate: true, duration: 1.2 });

      const highlightPoly = L.polygon(matchedParcel.ranh_coords, {
        color: '#ef4444',
        weight: 4,
        fillColor: '#fee2e2',
        fillOpacity: 0.7
      }).addTo(adminLayers.highlight);

      highlightPoly.bindPopup(`
        <div style="font-size:12px; color:#0f172a;">
          <b style="color:#ea580c; font-size:13px;">🎯 Tìm thấy Thửa ${matchedParcel.sothua} / Tờ ${matchedParcel.soto}</b><br/>
          <span>Địa chỉ: ${matchedParcel.tenphuongxa}, ${matchedParcel.tenquanhuyen}</span><br/>
          <span>Diện tích: <b>${matchedParcel.dientich_formatted || matchedParcel.dientich} m²</b></span>
        </div>
      `).openPopup();

      showToast(`🎯 Đã tìm thấy Thửa ${matchedParcel.sothua}/Tờ ${matchedParcel.soto} (${matchedParcel.tenphuongxa})`, 'success');
      return;
    }
  }

  showToast(`Không tìm thấy kết quả phù hợp với "${keyword}"`, 'warning');
};

// Switch Base Map (Esri Satellite, Google Satellite, OSM Street)
window.switchAdminBasemap = function(type) {
  if (!adminMap) return;
  adminMap.removeLayer(baseLayers.esriSatellite);
  adminMap.removeLayer(baseLayers.googleSatellite);
  adminMap.removeLayer(baseLayers.osmStreet);

  if (type === 'google') {
    baseLayers.googleSatellite.addTo(adminMap);
  } else if (type === 'osm') {
    baseLayers.osmStreet.addTo(adminMap);
  } else {
    baseLayers.esriSatellite.addTo(adminMap);
  }
  showToast(`Đã chuyển bản đồ nền sang: ${type.toUpperCase()}`, 'info');
};

// ----------------------------------------------------------------------------
// 5. LAYER VISIBILITY CONTROLLER FUNCTIONS (ADMIN)
// ----------------------------------------------------------------------------

window.toggleMetroBoundaries = function(show) {
  if (!adminMap) return;
  if (show === undefined) show = !adminMap.hasLayer(adminLayers.metroCorridorLines);
  if (show) {
    adminMap.addLayer(adminLayers.metroCorridorLines);
  } else {
    adminMap.removeLayer(adminLayers.metroCorridorLines);
  }
};

window.toggleMetroStationBoxes = function(show) {
  if (!adminMap) return;
  if (show === undefined) show = !adminMap.hasLayer(adminLayers.metroStationBoxes);
  if (show) {
    adminMap.addLayer(adminLayers.metroStationBoxes);
    adminMap.addLayer(adminLayers.metroStations);
  } else {
    adminMap.removeLayer(adminLayers.metroStationBoxes);
    adminMap.removeLayer(adminLayers.metroStations);
  }
};

window.toggleMetroDepot = function(show) {
  window.toggleMetroStationBoxes(show);
};

window.toggleMetroStations = function(show) {
  if (!adminMap) return;
  if (show === undefined) show = !adminMap.hasLayer(adminLayers.metroStations);
  if (show) {
    adminMap.addLayer(adminLayers.metroStations);
  } else {
    adminMap.removeLayer(adminLayers.metroStations);
  }
};

window.toggleMetroBuffer = function(show) {
  if (!adminMap) return;
  if (show === undefined) show = !adminMap.hasLayer(adminLayers.metroBuffer50m);
  if (show) {
    adminMap.addLayer(adminLayers.metroBuffer50m);
  } else {
    adminMap.removeLayer(adminLayers.metroBuffer50m);
  }
};

window.toggleKS003Parcels = function(show) {
  if (!adminMap) return;
  if (show === undefined) show = !adminMap.hasLayer(adminLayers.ks003Parcels);
  if (show) {
    adminMap.addLayer(adminLayers.ks003Parcels);
  } else {
    adminMap.removeLayer(adminLayers.ks003Parcels);
  }
};

window.toggleSurveyZones = function(show) {
  if (!adminMap) return;
  if (show === undefined) show = !adminMap.hasLayer(adminLayers.zones);
  if (show) {
    adminMap.addLayer(adminLayers.zones);
  } else {
    adminMap.removeLayer(adminLayers.zones);
  }
};

window.toggleSurveyedBuildings = function(show) {
  if (!adminMap) return;
  if (show === undefined) show = !adminMap.hasLayer(adminLayers.buildings);
  if (show) {
    adminMap.addLayer(adminLayers.buildings);
  } else {
    adminMap.removeLayer(adminLayers.buildings);
  }
};

// Render Survey Zones
function renderSurveyZones() {
  if (!adminMap) return;
  adminLayers.zones.clearLayers();

  MOCK_DATA.surveyZones.forEach(zone => {
    const poly = L.polygon(zone.polygon, {
      color: zone.color,
      fillColor: zone.color,
      fillOpacity: 0.15,
      weight: 2,
      dashArray: '5, 5',
      renderer: canvasRenderer
    }).addTo(adminLayers.zones);

    poly.bindPopup(`
      <div style="font-size:12px; line-height:1.4;">
        <strong style="color:${zone.color}; font-size:13px;">${zone.name}</strong><br/>
        <b>Cán bộ phụ trách:</b> ${zone.surveyor}<br/>
        <b>Tiến độ:</b> ${zone.completed} / ${zone.totalHousesEst} căn (${Math.round(zone.completed/zone.totalHousesEst*100)}%)
      </div>
    `);
  });
}

// Render Building Footprints & Status Pins
function renderBuildingsOnAdminMap() {
  if (!adminMap) return;
  adminLayers.buildings.clearLayers();

  MOCK_DATA.buildings.forEach(b => {
    let color = '#64748b';
    let statusText = 'Chưa khảo sát';

    if (b.status === 'approved') { color = '#10b981'; statusText = 'Đã duyệt'; }
    else if (b.status === 'pending') { color = b.flagged ? '#ef4444' : '#0284c7'; statusText = b.flagged ? '⚠️ Cảnh báo sai lệch GPS' : 'Chờ duyệt'; }
    else if (b.status === 'surveying') { color = '#f59e0b'; statusText = 'Đang khảo sát'; }

    // Draw Footprint Polygon if available
    if (b.footprint && b.footprint.length >= 3) {
      const poly = L.polygon(b.footprint, {
        color: color,
        fillColor: color,
        fillOpacity: 0.55,
        weight: 2.5
      }).addTo(adminLayers.buildings);

      poly.on('click', () => {
        if (window.openApprovalDrawer) window.openApprovalDrawer(b.id);
      });
    }

    // Centroid Marker Pin
    const markerIcon = L.divIcon({
      className: 'building-pin',
      html: `<div style="background:${color};width:14px;height:14px;border-radius:50%;border:2px solid #fff;box-shadow:0 0 10px ${color};cursor:pointer;"></div>`,
      iconSize: [14, 14],
      iconAnchor: [7, 7]
    });

    const marker = L.marker([b.pinGps.lat, b.pinGps.lng], { icon: markerIcon }).addTo(adminLayers.buildings);
    
    marker.bindPopup(`
      <div style="font-size:12px; line-height:1.5;">
        <b style="color:${color}; font-size:13px;">${b.houseCode} - ${b.ownerName}</b><br/>
        <span>📍 ${b.address}</span><br/>
        <span>Trạng thái: <b>${statusText}</b></span><br/>
        <span>Sai lệch GPS: <b>${b.deviationMeters}m</b></span><br/>
        <button onclick="window.openApprovalDrawer('${b.id}')" style="margin-top:6px;width:100%;padding:5px;background:#0284c7;color:#fff;border:none;border-radius:4px;cursor:pointer;font-weight:700;">Xem chi tiết & Kiểm duyệt</button>
      </div>
    `);
  });
}

// Quick action: Admin or Surveyor clicks a parcel to initialize survey form
window.startSurveyForParcel = function(mathua, sothua, soto, phuong, quan, lat, lng) {
  currentSurveyData.houseCode = `TB-THUA-${sothua}`;
  currentSurveyData.address = `Thửa ${sothua}, Tờ ${soto}, ${phuong}, ${quan}`;
  currentSurveyData.pinGps = { lat, lng };
  currentSurveyData.hardwareGps = { lat, lng };
  currentSurveyData.deviationMeters = 0.0;

  const codeInput = document.getElementById('input-house-code');
  const addrInput = document.getElementById('input-address');
  if (codeInput) codeInput.value = currentSurveyData.houseCode;
  if (addrInput) addrInput.value = currentSurveyData.address;

  if (mobileGpsMap) {
    mobileGpsMap.setView([lat, lng], 19);
    if (mobileLayers.gpsMarkerPin) mobileLayers.gpsMarkerPin.setLatLng([lat, lng]);
    if (mobileLayers.gpsMarkerHw) mobileLayers.gpsMarkerHw.setLatLng([lat, lng]);
    if (mobileLayers.connLine) mobileLayers.connLine.setLatLngs([[lat, lng], [lat, lng]]);
  }

  showToast(`📍 Đã gán thông tin Thửa ${sothua}/Tờ ${soto} vào form khảo sát di động!`, 'success');
  if (window.setViewMode && window.innerWidth > 768) {
    window.setViewMode('split');
  }
};

// ----------------------------------------------------------------------------
// 6. MOBILE FIELD SURVEYOR MAPS WITH INTEGRATED PARCELS & METRO BOUNDARIES
// ----------------------------------------------------------------------------

function initMobileGpsMap() {
  const container = document.getElementById('mobile-gps-map');
  if (!container || mobileGpsMap) return;

  mobileGpsMap = L.map('mobile-gps-map', {
    zoomControl: false,
    attributionControl: false
  }).setView([currentSurveyData.hardwareGps.lat, currentSurveyData.hardwareGps.lng], 19);

  mobileLayers.satelliteTile = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 20
  }).addTo(mobileGpsMap);

  mobileLayers.streetTile = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 20
  });

  mobileLayers.parcels = L.featureGroup().addTo(mobileGpsMap);
  mobileLayers.metroBoundaries = L.featureGroup().addTo(mobileGpsMap);

  // Hardware GPS Marker (Green Pulse)
  const hardwareIcon = L.divIcon({
    className: 'hardware-gps-marker',
    html: `<div style="background:#10b981;width:14px;height:14px;border-radius:50%;border:2px solid #fff;box-shadow:0 0 12px #10b981;"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7]
  });

  mobileLayers.gpsMarkerHw = L.marker([currentSurveyData.hardwareGps.lat, currentSurveyData.hardwareGps.lng], {
    icon: hardwareIcon
  }).addTo(mobileGpsMap);

  // Pin GPS Marker (Draggable Blue Pin)
  const pinIcon = L.divIcon({
    className: 'pin-gps-marker',
    html: `<div style="background:#0284c7;width:20px;height:20px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:2px solid #fff;box-shadow:0 0 10px #0284c7;"></div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 20]
  });

  mobileLayers.gpsMarkerPin = L.marker([currentSurveyData.pinGps.lat, currentSurveyData.pinGps.lng], {
    icon: pinIcon,
    draggable: true
  }).addTo(mobileGpsMap);

  // Connecting Line between Hardware & Pin GPS
  mobileLayers.connLine = L.polyline([
    [currentSurveyData.hardwareGps.lat, currentSurveyData.hardwareGps.lng],
    [currentSurveyData.pinGps.lat, currentSurveyData.pinGps.lng]
  ], {
    color: '#0284c7',
    weight: 2,
    dashArray: '4, 4'
  }).addTo(mobileGpsMap);

  // Update on Drag
  mobileLayers.gpsMarkerPin.on('drag', (e) => {
    const newPos = e.target.getLatLng();
    currentSurveyData.pinGps = { lat: newPos.lat, lng: newPos.lng };
    
    mobileLayers.connLine.setLatLngs([
      [currentSurveyData.hardwareGps.lat, currentSurveyData.hardwareGps.lng],
      [newPos.lat, newPos.lng]
    ]);

    const dist = calculateDistanceMeters(
      currentSurveyData.hardwareGps.lat, currentSurveyData.hardwareGps.lng,
      newPos.lat, newPos.lng
    );
    currentSurveyData.deviationMeters = parseFloat(dist.toFixed(1));

    const meterEl = document.getElementById('mobile-gps-deviation-meter');
    if (meterEl) {
      meterEl.innerText = `${currentSurveyData.deviationMeters}m`;
      if (currentSurveyData.deviationMeters > 50) {
        meterEl.style.color = '#ef4444';
        document.getElementById('mobile-gps-warning')?.style.setProperty('display', 'block');
      } else {
        meterEl.style.color = '#0284c7';
        document.getElementById('mobile-gps-warning')?.style.setProperty('display', 'none');
      }
    }
  });

  renderMobileParcelsAndBoundaries();
}

// Render surrounding Parcels and Metro boundaries onto Mobile Map
function renderMobileParcelsAndBoundaries() {
  if (!mobileGpsMap) return;
  mobileLayers.parcels.clearLayers();
  mobileLayers.metroBoundaries.clearLayers();

  // Render Metro CAD boundaries on mobile
  const source = (typeof METRO_LINE2_OFFICIAL !== 'undefined') ? METRO_LINE2_OFFICIAL : null;
  if (source && source.corridorBoundaries) {
    source.corridorBoundaries.forEach(line => {
      L.polyline(line.coords, {
        color: '#ef4444',
        weight: 2.5,
        opacity: 0.85,
        dashArray: '5, 4'
      }).addTo(mobileLayers.metroBoundaries);
    });
  }

  // Render local parcels around current GPS position (Radius ~500m)
  if (ks003ParcelsData) {
    const cLat = currentSurveyData.pinGps.lat;
    const cLng = currentSurveyData.pinGps.lng;
    const pKeys = Object.keys(ks003ParcelsData);

    pKeys.forEach(k => {
      const p = ks003ParcelsData[k];
      if (!p.ranh_coords || p.ranh_coords.length < 3) return;

      const pCenter = p.ranh_coords[0];
      const dist = calculateDistanceMeters(cLat, cLng, pCenter[0], pCenter[1]);

      // Only draw parcels within 600m to keep mobile super fast
      if (dist < 600) {
        const poly = L.polygon(p.ranh_coords, {
          color: '#ea580c',
          weight: 1.5,
          fillColor: '#fb923c',
          fillOpacity: 0.35
        }).addTo(mobileLayers.parcels);

        // Click on mobile parcel to auto-fill survey info
        poly.on('click', () => {
          poly.bindPopup(`
            <div style="font-size:11px; line-height:1.4;">
              <b style="color:#ea580c;">🏢 Thửa ${p.sothua} / Tờ ${p.soto}</b><br/>
              <span>${p.tenphuongxa}, ${p.tenquanhuyen}</span><br/>
              <span>DT: <b>${p.dientich_formatted || p.dientich} m²</b></span><br/>
              <button onclick="startSurveyForParcel('${p.mathuadat}', '${p.sothua}', '${p.soto}', '${p.tenphuongxa}', '${p.tenquanhuyen}', ${p.ranh_coords[0][0]}, ${p.ranh_coords[0][1]})" style="margin-top:4px;width:100%;padding:4px;background:#0284c7;color:#fff;border:none;border-radius:4px;font-weight:700;cursor:pointer;">
                ⚡ Chọn Thửa Này
              </button>
            </div>
          `).openPopup();
        });
      }
    });
  }
}

// Mobile Quick Toggles
window.toggleMobileParcels = function() {
  if (!mobileGpsMap) return;
  const has = mobileGpsMap.hasLayer(mobileLayers.parcels);
  if (has) {
    mobileGpsMap.removeLayer(mobileLayers.parcels);
    showToast('Đã ẩn lớp thửa đất trên điện thoại', 'info');
  } else {
    mobileGpsMap.addLayer(mobileLayers.parcels);
    showToast('Đã hiện lớp thửa đất trên điện thoại', 'info');
  }
};

window.toggleMobileMetro = function() {
  if (!mobileGpsMap) return;
  const has = mobileGpsMap.hasLayer(mobileLayers.metroBoundaries);
  if (has) {
    mobileGpsMap.removeLayer(mobileLayers.metroBoundaries);
    showToast('Đã ẩn ranh Metro trên điện thoại', 'info');
  } else {
    mobileGpsMap.addLayer(mobileLayers.metroBoundaries);
    showToast('Đã hiện ranh Metro trên điện thoại', 'info');
  }
};

window.toggleMobileBasemap = function() {
  if (!mobileGpsMap) return;
  const isSat = mobileGpsMap.hasLayer(mobileLayers.satelliteTile);
  if (isSat) {
    mobileGpsMap.removeLayer(mobileLayers.satelliteTile);
    mobileLayers.streetTile.addTo(mobileGpsMap);
    showToast('Bản đồ di động: Bản đồ đường phố', 'info');
  } else {
    mobileGpsMap.removeLayer(mobileLayers.streetTile);
    mobileLayers.satelliteTile.addTo(mobileGpsMap);
    showToast('Bản đồ di động: Bản đồ vệ tinh', 'info');
  }
};

window.centerMobileGps = function() {
  if (!mobileGpsMap) return;
  mobileGpsMap.setView([currentSurveyData.hardwareGps.lat, currentSurveyData.hardwareGps.lng], 19);
  showToast('Đã đưa bản đồ về vị trí GPS của bạn', 'info');
};

// Initialize Mobile Footprint Drawing Mini-Map
function initMobileFootprintMap() {
  const container = document.getElementById('mobile-footprint-map');
  if (!container || mobileFootprintMap) return;

  mobileFootprintMap = L.map('mobile-footprint-map', {
    zoomControl: false,
    attributionControl: false
  }).setView([currentSurveyData.pinGps.lat, currentSurveyData.pinGps.lng], 19);

  L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 20
  }).addTo(mobileFootprintMap);

  let drawnPoints = [];
  let polyline = L.polyline([], { color: '#0284c7', weight: 3 }).addTo(mobileFootprintMap);
  let polygon = L.polygon([], { color: '#10b981', fillColor: '#10b981', fillOpacity: 0.45 }).addTo(mobileFootprintMap);

  mobileFootprintMap.on('click', (e) => {
    drawnPoints.push([e.latlng.lat, e.latlng.lng]);
    currentSurveyData.footprint = [...drawnPoints];

    polyline.setLatLngs(drawnPoints);
    if (drawnPoints.length >= 3) {
      polygon.setLatLngs(drawnPoints);
    }

    const countEl = document.getElementById('footprint-point-count');
    if (countEl) countEl.innerText = `${drawnPoints.length} điểm`;
  });

  window.clearFootprintDrawing = () => {
    drawnPoints = [];
    currentSurveyData.footprint = [];
    polyline.setLatLngs([]);
    polygon.setLatLngs([]);
    const countEl = document.getElementById('footprint-point-count');
    if (countEl) countEl.innerText = `0 điểm`;
  };

  // Preload default sample polygon if empty
  window.loadSampleFootprint = () => {
    const cLat = currentSurveyData.pinGps.lat;
    const cLng = currentSurveyData.pinGps.lng;
    drawnPoints = [
      [cLat + 0.00003, cLng - 0.00004],
      [cLat + 0.00005, cLng + 0.00004],
      [cLat - 0.00003, cLng + 0.00006],
      [cLat - 0.00004, cLng - 0.00003]
    ];
    currentSurveyData.footprint = [...drawnPoints];
    polyline.setLatLngs(drawnPoints);
    polygon.setLatLngs(drawnPoints);
    const countEl = document.getElementById('footprint-point-count');
    if (countEl) countEl.innerText = `${drawnPoints.length} điểm (Mẫu)`;
  };
}
