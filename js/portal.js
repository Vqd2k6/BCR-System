/**
 * KSQH METRO 2 — WEB PORTAL JAVASCRIPT
 * Complete rewrite v2.0
 * Architecture: Module pattern, no build tools required
 */

'use strict';

// ============================================================================
// CONFIG & STATE
// ============================================================================
const CONFIG = {
  API_BASE: 'http://localhost:3001/api',
  MAP_CENTER: [10.7900, 106.6490], // Ho Chi Minh City
  MAP_ZOOM: 14,
  MOCK_MODE: true, // Use mock data when backend offline
};

const STATE = {
  currentBuilding: null,
  currentTab: 'map',
  currentDetailTab: 'phase1',
  buildings: [],
  filterStatus: 'all',
  map: null,
  mapMarkers: {},
  token: localStorage.getItem('portal_token') || null,
  user: JSON.parse(localStorage.getItem('portal_user') || 'null'),
  pendingSignatureRole: null,
  signaturePad: null,
};

// ============================================================================
// MOCK DATA
// ============================================================================
const MOCK = {
  user: { id: 'u-admin', fullName: 'Trần Quốc Đại', role: 'ZONE_MANAGER', employeeCode: 'QD-01' },
  buildings: [
    {
      id: 'b-001', building_code: 'TB-BH-001', owner_name: 'Lê Thị Hoa', owner_phone: '0912345678',
      address: '45 Cộng Hòa, P.12, Q. Tân Bình', ward: 'Phường 12', district: 'Tân Bình',
      building_use: 'RESIDENTIAL', importance_group: 'GENERAL', storeys_above: 3, storeys_basement: 0,
      construction_year: 1998, structural_system: 'RC_FRAME', foundation_type: 'SHALLOW', foundation_cat: 3,
      chainage_km: 'Km 8+420', distance_to_metro_m: 28.5,
      phase1_status: 'APPROVED', phase2_status: 'SUBMITTED',
      deviation_meters: 4.2, is_flagged: false,
      pin_geometry: { type: 'Point', coordinates: [106.649200, 10.790800] },
    },
    {
      id: 'b-002', building_code: 'TB-BH-002', owner_name: 'Nguyễn Văn Phú', owner_phone: '0987654321',
      address: '102 Trường Chinh, P.15, Q. Tân Bình', ward: 'Phường 15', district: 'Tân Bình',
      building_use: 'COMMERCIAL', importance_group: 'IMPORTANT', storeys_above: 5, storeys_basement: 1,
      construction_year: 2005, structural_system: 'RC_FRAME', foundation_type: 'PRECAST_RC_PILE', foundation_cat: 2,
      chainage_km: 'Km 8+650', distance_to_metro_m: 51.3,
      phase1_status: 'APPROVED', phase2_status: 'APPROVED',
      deviation_meters: 62.8, is_flagged: true,
      pin_geometry: { type: 'Point', coordinates: [106.651500, 10.791500] },
    },
    {
      id: 'b-003', building_code: 'TB-BH-003', owner_name: 'Phạm Quỳnh Anh', owner_phone: '0978563412',
      address: '8/3 Đặng Văn Bi, P.Trường Thọ, Q. Thủ Đức', ward: 'Phường Trường Thọ', district: 'Thủ Đức',
      building_use: 'RESIDENTIAL', importance_group: 'GENERAL', storeys_above: 2, storeys_basement: 0,
      construction_year: 1985, structural_system: 'LOAD_BEARING_MASONRY', foundation_type: 'WOOD_PILE', foundation_cat: 5,
      chainage_km: 'Km 8+180', distance_to_metro_m: 14.1,
      phase1_status: 'SUBMITTED', phase2_status: 'NOT_STARTED',
      deviation_meters: 1.8, is_flagged: false,
      pin_geometry: { type: 'Point', coordinates: [106.647000, 10.789500] },
    },
    {
      id: 'b-004', building_code: 'TB-BH-004', owner_name: 'Trần Minh Đức', owner_phone: '0905432198',
      address: '77 Bàu Cát, P.14, Q. Tân Bình', ward: 'Phường 14', district: 'Tân Bình',
      building_use: 'RESIDENTIAL', importance_group: 'GENERAL', storeys_above: 1, storeys_basement: 0,
      construction_year: 1975, structural_system: 'LOAD_BEARING_MASONRY', foundation_type: 'UNKNOWN', foundation_cat: 5,
      chainage_km: 'Km 8+950', distance_to_metro_m: 43.7,
      phase1_status: 'REJECTED', phase2_status: 'NOT_STARTED',
      deviation_meters: 8.6, is_flagged: false,
      pin_geometry: { type: 'Point', coordinates: [106.653000, 10.792500] },
    },
    {
      id: 'b-005', building_code: 'TB-BH-005', owner_name: 'Võ Thị Lan', owner_phone: '0941236789',
      address: '23 Bạch Đằng, P.2, Q. Tân Bình', ward: 'Phường 2', district: 'Tân Bình',
      building_use: 'PUBLIC', importance_group: 'CRITICAL', storeys_above: 4, storeys_basement: 0,
      construction_year: 2010, structural_system: 'RC_FRAME', foundation_type: 'BORED_PILE', foundation_cat: 1,
      chainage_km: 'Km 9+120', distance_to_metro_m: 22.3,
      phase1_status: 'NOT_STARTED', phase2_status: 'NOT_STARTED',
      deviation_meters: 3.1, is_flagged: false,
      pin_geometry: { type: 'Point', coordinates: [106.655000, 10.793000] },
    },
  ],
  phase1Detail: {
    ecs_total_score: 11, ecs_class: 'DEFICIENT',
    e1_structural_cracks: 3, e2_wall_masonry_cracks: 2, e3_deformation_tilt: 1,
    e4_water_seepage_deterioration: 2, e5_history_integrity: 2, e6_functionality_state: 1,
    structural_flag: 'HIGH',
    vi_average: 2.83, vi_class: 'HIGH',
    v1_use_consequence: 2, v2_structural_fragility: 3, v3_foundation_uncertainty: 3,
    v4_age_modifications: 3, v5_existing_condition: 3, v6_sensitive_equipment: 1,
    construction_impact_class: 'I3_HIGH',
    bra_result: 'VERY_HIGH',
    recommended_action: 'SPECIALIST_REVIEW_HOLD_POINT',
    bcs_screening_results: { crackWall: true, crackStructural: true, settlementTilt: false, waterSeepage: true, spalling: false, activeDeveloping: true, details: 'Nứt chân cột trục A, B — vết nứt đang phát triển. Thấm dột mạnh ở trần tầng 1.' },
    surveyor_name: 'Nguyễn Văn Hùng',
    submitted_at: '2026-09-10T08:30:00Z',
    approved_at: '2026-09-11T14:15:00Z',
  },
  phase2Detail: {
    access_status: 'FULL',
    surveyed_areas: ['Mặt tiền', 'Hông trái', 'Mái', 'Tầng 1', 'Tầng 2'],
    repairs_since_phase1: true,
    repairs_description: 'Trát lại vết nứt tường tầng 1 bằng vữa xi măng',
    new_external_damages: false,
    current_usage_state: 'Ổn định',
    tilt_angle_degree: 0.4,
    tilt_direction: 'Về phía trước',
    tilt_measurement_method: 'Laser level',
    has_critical_damage_alert: false,
    overall_condition_summary: 'MONITOR',
    sketch_photo_url: null,
  },
  defects: [
    {
      defect_code: 'D-01', floor_name: 'Tầng Trệt', room_or_zone: 'Phòng khách', structural_element: 'COLUMN',
      defect_type: 'CRACK', max_crack_width_mm: 1.5, crack_length_m: 0.85, crack_direction: 'DIAGONAL_45',
      activity_status: 'ACTIVE_DEVELOPING', comparison_with_phase1: 'DEVELOPED_WIDER',
      phase1_width_mm: 0.8, delta_width_change_mm: 0.7, burland_grade: 3, defect_notes: 'Nứt chân cột, đang mở rộng',
    },
    {
      defect_code: 'D-02', floor_name: 'Tầng Trệt', room_or_zone: 'Bếp', structural_element: 'WALL',
      defect_type: 'WATER_SEEPAGE', max_crack_width_mm: null, crack_length_m: null,
      activity_status: 'STATIC', comparison_with_phase1: 'UNCHANGED',
      burland_grade: 2, defect_notes: 'Thấm từ hàng xóm, ẩm nhẹ',
    },
    {
      defect_code: 'D-03', floor_name: 'Lầu 1', room_or_zone: 'Phòng ngủ 1', structural_element: 'CEILING',
      defect_type: 'SPALLING_DELAMINATION', max_crack_width_mm: 2.2, crack_length_m: 1.2,
      activity_status: 'ACTIVE_DEVELOPING', comparison_with_phase1: 'NEWLY_OBSERVED',
      burland_grade: 3, defect_notes: 'Bong tróc lớp vữa trần, lộ sắt thép',
    },
  ],
  signatures: [
    { sign_role: 'OWNER_RESIDENT', signer_full_name: 'Lê Thị Hoa', signer_title: 'Chủ hộ', signed_at: '2026-09-12T10:00:00Z', is_refused: false, platform_origin: 'MOBILE_APP' },
    { sign_role: 'SURVEYOR', signer_full_name: 'Nguyễn Văn Hùng', signer_title: 'Kỹ sư KS', signed_at: '2026-09-12T10:15:00Z', is_refused: false, platform_origin: 'MOBILE_APP' },
    { sign_role: 'CONTRACTOR', signer_full_name: null, platform_origin: 'WEB_PORTAL' },
    { sign_role: 'LOCAL_AUTHORITY', signer_full_name: null, platform_origin: 'WEB_PORTAL' },
  ],
  auditLogs: [
    { action: 'PHASE2_SUBMIT', user: 'Nguyễn Văn Hùng', created_at: '2026-09-12T10:30:00Z', details: 'Nộp hồ sơ Phase 2 — 3 khuyết tật' },
    { action: 'SIGNATURE_MOBILE', user: 'Lê Thị Hoa', created_at: '2026-09-12T10:15:00Z', details: 'Chủ hộ ký xác nhận' },
    { action: 'PHASE1_APPROVE', user: 'Trần Quốc Đại', created_at: '2026-09-11T14:15:00Z', details: 'ECS=11/DEFICIENT, BRA=VERY_HIGH' },
    { action: 'PHASE1_SUBMIT', user: 'Nguyễn Văn Hùng', created_at: '2026-09-10T08:30:00Z', details: 'Nộp hồ sơ Phase 1' },
  ],
};

// ============================================================================
// UTILITIES
// ============================================================================
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

function escHtml(str) {
  const d = document.createElement('div');
  d.appendChild(document.createTextNode(str ?? ''));
  return d.innerHTML;
}

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function showToast(msg, type = 'info', duration = 3500) {
  const icons = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span class="toast-icon">${icons[type]}</span><span>${escHtml(msg)}</span>`;
  $('#toast-container').appendChild(toast);
  setTimeout(() => toast.remove(), duration);
}

function statusClass(st) {
  const m = { APPROVED: 'status-approved', SUBMITTED: 'status-pending', PENDING_APPROVAL: 'status-pending', REJECTED: 'status-rejected', IN_PROGRESS: 'status-progress', NOT_STARTED: 'status-none' };
  return m[st] || 'status-none';
}

function statusLabel(st) {
  const m = { APPROVED: 'Đã duyệt', SUBMITTED: 'Chờ duyệt', PENDING_APPROVAL: 'Chờ duyệt', REJECTED: 'Từ chối', IN_PROGRESS: 'Đang KS', NOT_STARTED: 'Chưa bắt đầu' };
  return m[st] || st;
}

function ecsColorClass(cls) {
  const m = { GOOD: '#10B981', MEDIUM: '#F59E0B', DEFICIENT: '#F97316', CRITICAL: '#EF4444' };
  return m[cls] || '#64748B';
}

function braColorClass(bra) {
  const m = { LOW: 'low', MEDIUM: 'medium', HIGH: 'high', VERY_HIGH: 'very-high', PENDING: 'medium' };
  return m[bra] || 'medium';
}

function deltaClass(d) {
  const m = { NEWLY_OBSERVED: 'delta-new', DEVELOPED_WIDER: 'delta-worse', DEVELOPED_LONGER: 'delta-worse', UNCHANGED: 'delta-same', REPAIRED: 'delta-repair' };
  return m[d] || 'delta-same';
}

function deltaLabel(d) {
  const m = { NEWLY_OBSERVED: '🆕 Mới', DEVELOPED_WIDER: '↑ Rộng hơn', DEVELOPED_LONGER: '↑ Dài hơn', UNCHANGED: '— Không đổi', REPAIRED: '✓ Đã sửa' };
  return m[d] || d;
}

function ecsLabel(cls) {
  const m = { GOOD: 'TỐT', MEDIUM: 'TRUNG BÌNH', DEFICIENT: 'KÉM', CRITICAL: 'NGUY CẤP' };
  return m[cls] || cls;
}

function viLabel(cls) {
  const m = { LOW: 'THẤP', MEDIUM: 'TRUNG BÌNH', HIGH: 'CAO', VERY_HIGH: 'RẤT CAO' };
  return m[cls] || cls;
}

function braLabel(bra) {
  const m = { LOW: 'THẤP', MEDIUM: 'TRUNG BÌNH', HIGH: 'CAO', VERY_HIGH: 'RẤT CAO', PENDING: 'CHỜ DỮ LIỆU' };
  return m[bra] || bra;
}

// ============================================================================
// API LAYER
// ============================================================================
const API = {
  async request(method, endpoint, body) {
    if (CONFIG.MOCK_MODE) return null;
    const res = await fetch(CONFIG.API_BASE + endpoint, {
      method,
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${STATE.token}` },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) throw new Error((await res.json()).message || res.statusText);
    return res.json();
  },

  getBuildings: () => CONFIG.MOCK_MODE ? Promise.resolve(MOCK.buildings) : API.request('GET', '/buildings').then(r => r.data),
  approvePhase1: (id) => CONFIG.MOCK_MODE
    ? Promise.resolve({ success: true })
    : API.request('PATCH', `/buildings/${id}/phase1/approve`),
  rejectPhase1: (id, reason) => CONFIG.MOCK_MODE
    ? Promise.resolve({ success: true })
    : API.request('PATCH', `/buildings/${id}/phase1/reject`, { rejectionReason: reason }),
  approvePhase2: (id) => CONFIG.MOCK_MODE
    ? Promise.resolve({ success: true })
    : API.request('PATCH', `/buildings/${id}/phase2/approve`),
  rejectPhase2: (id, reason) => CONFIG.MOCK_MODE
    ? Promise.resolve({ success: true })
    : API.request('PATCH', `/buildings/${id}/phase2/reject`, { rejectionReason: reason }),
  signWeb: (id, payload) => CONFIG.MOCK_MODE
    ? Promise.resolve({ success: true })
    : API.request('POST', `/buildings/${id}/phase2/signatures/web`, payload),
};

// ============================================================================
// MAP MODULE
// ============================================================================
const MapModule = {
  init() {
    const L = window.L;
    if (!L) { console.warn('Leaflet not loaded'); return; }

    STATE.map = L.map('leaflet-map', {
      center: CONFIG.MAP_CENTER,
      zoom: CONFIG.MAP_ZOOM,
      zoomControl: false,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap',
      maxZoom: 19,
    }).addTo(STATE.map);

    // Draw metro corridor
    const metro = L.polyline([
      [10.773, 106.682], [10.782, 106.669], [10.790, 106.653], [10.796, 106.640], [10.800, 106.622]
    ], { color: '#38BDF8', weight: 5, opacity: 0.65, dashArray: '12,4' }).addTo(STATE.map);

    // Buffer zone
    const bufferPoints = [
      [10.775, 106.685], [10.784, 106.670], [10.792, 106.653], [10.798, 106.638], [10.803, 106.620],
      [10.797, 106.620], [10.792, 106.638], [10.788, 106.655], [10.780, 106.671], [10.771, 106.683]
    ];
    L.polygon(bufferPoints, { color: '#0284C7', fillColor: '#0284C7', fillOpacity: 0.08, weight: 1.5, opacity: 0.4 }).addTo(STATE.map);

    this.renderMarkers(STATE.buildings);
  },

  renderMarkers(buildings) {
    const L = window.L;
    if (!L || !STATE.map) return;

    // Clear existing
    Object.values(STATE.mapMarkers).forEach(m => STATE.map.removeLayer(m));
    STATE.mapMarkers = {};

    buildings.forEach(b => {
      if (!b.pin_geometry?.coordinates) return;
      const [lng, lat] = b.pin_geometry.coordinates;
      const color = this._statusColor(b);
      const flagHtml = b.is_flagged ? '<div style="position:absolute;top:-4px;right:-4px;width:10px;height:10px;background:#F59E0B;border-radius:50%;border:1px solid #0F1117;"></div>' : '';

      const icon = L.divIcon({
        className: '',
        html: `<div style="position:relative;width:28px;height:28px;">
          <div style="width:28px;height:28px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:${color};border:2px solid rgba(255,255,255,0.3);box-shadow:0 2px 8px rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;">
            <div style="transform:rotate(45deg);font-size:9px;font-weight:800;color:white;font-family:monospace">${b.phase2_status === 'APPROVED' ? 'P2' : b.phase1_status === 'APPROVED' ? 'P1' : '?'}</div>
          </div>
          ${flagHtml}
        </div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 28],
      });

      const marker = L.marker([lat, lng], { icon })
        .addTo(STATE.map)
        .on('click', () => DetailPanel.open(b));

      marker.bindTooltip(`<div style="font-family:monospace;font-weight:700;font-size:11px;">${b.building_code}</div><div style="font-size:10px;">${b.owner_name}</div>`, { direction: 'top', offset: [0, -30] });

      STATE.mapMarkers[b.id] = marker;
    });
  },

  _statusColor(b) {
    if (b.is_flagged) return '#F59E0B';
    if (b.phase2_status === 'APPROVED') return '#10B981';
    if (b.phase2_status === 'SUBMITTED') return '#7C3AED';
    if (b.phase1_status === 'APPROVED') return '#0284C7';
    if (b.phase1_status === 'SUBMITTED') return '#3B82F6';
    if (b.phase1_status === 'REJECTED') return '#EF4444';
    return '#64748B';
  },

  flyTo(building) {
    if (!STATE.map || !building.pin_geometry) return;
    const [lng, lat] = building.pin_geometry.coordinates;
    STATE.map.flyTo([lat, lng], 17, { duration: 1.2 });
  },
};

// ============================================================================
// BUILDING LIST MODULE
// ============================================================================
const BuildingList = {
  render(buildings) {
    const list = $('#building-list');
    if (!list) return;

    if (!buildings.length) {
      list.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🏚️</div><div class="empty-state-title">Không tìm thấy công trình</div></div>';
      return;
    }

    list.innerHTML = buildings.map(b => `
      <div class="building-item ${STATE.currentBuilding?.id === b.id ? 'selected' : ''}" data-id="${b.id}">
        <div class="building-status-dot" style="background:${this._dotColor(b)}"></div>
        <div class="building-info">
          <div class="building-code">${escHtml(b.building_code)}</div>
          <div class="building-owner">${escHtml(b.owner_name)}</div>
        </div>
        <div class="building-phase-badges">
          <span class="phase-badge ${this._phaseClass(b.phase1_status)}">P1</span>
          <span class="phase-badge ${this._phaseClass(b.phase2_status)}">P2</span>
        </div>
      </div>
    `).join('');

    $$('.building-item').forEach(el => {
      el.addEventListener('click', () => {
        const b = STATE.buildings.find(x => x.id === el.dataset.id);
        if (b) DetailPanel.open(b);
      });
    });
  },

  _dotColor(b) {
    if (b.is_flagged) return '#F59E0B';
    if (b.phase2_status === 'APPROVED') return '#10B981';
    if (b.phase1_status === 'APPROVED') return '#0284C7';
    if (b.phase1_status === 'REJECTED') return '#EF4444';
    if (b.phase1_status === 'SUBMITTED') return '#3B82F6';
    return '#475569';
  },

  _phaseClass(st) {
    const m = { APPROVED: 'approved', SUBMITTED: 'pending', PENDING_APPROVAL: 'pending', REJECTED: 'rejected', NOT_STARTED: 'none', IN_PROGRESS: 'none' };
    return m[st] || 'none';
  },

  updateKPIs(buildings) {
    const total    = buildings.length;
    const approved = buildings.filter(b => b.phase2_status === 'APPROVED' || b.phase1_status === 'APPROVED').length;
    const pending  = buildings.filter(b => b.phase1_status === 'SUBMITTED' || b.phase2_status === 'SUBMITTED').length;
    const flagged  = buildings.filter(b => b.is_flagged).length;

    $('#kpi-total').textContent   = total;
    $('#kpi-approved').textContent = approved;
    $('#kpi-pending').textContent  = pending;
    $('#kpi-flagged').textContent  = flagged;
    $('#progress-fill').style.width = total ? `${Math.round(approved / total * 100)}%` : '0%';
    $('#progress-pct').textContent  = total ? `${Math.round(approved / total * 100)}%` : '0%';
    $('#progress-val').textContent  = `${approved}/${total} công trình`;
  },

  filter(keyword, status) {
    return STATE.buildings.filter(b => {
      const matchKw = !keyword ||
        b.building_code.toLowerCase().includes(keyword.toLowerCase()) ||
        b.owner_name.toLowerCase().includes(keyword.toLowerCase()) ||
        b.address.toLowerCase().includes(keyword.toLowerCase());
      const matchSt = status === 'all' ||
        (status === 'p1_pending' && b.phase1_status === 'SUBMITTED') ||
        (status === 'p2_pending' && b.phase2_status === 'SUBMITTED') ||
        (status === 'flagged' && b.is_flagged) ||
        (status === 'done' && b.phase2_status === 'APPROVED');
      return matchKw && matchSt;
    });
  },
};

// ============================================================================
// DETAIL PANEL MODULE
// ============================================================================
const DetailPanel = {
  open(building) {
    STATE.currentBuilding = building;
    this._renderHeader(building);
    this.switchTab('phase1');
    $('#detail-panel').classList.add('open');
    BuildingList.render(BuildingList.filter($('#search-input')?.value || '', STATE.filterStatus));
    MapModule.flyTo(building);
  },

  close() {
    $('#detail-panel').classList.remove('open');
    STATE.currentBuilding = null;
    BuildingList.render(BuildingList.filter($('#search-input')?.value || '', STATE.filterStatus));
  },

  _renderHeader(b) {
    $('#panel-building-code').textContent = b.building_code;
    $('#panel-owner').textContent = `${b.owner_name}  ·  ${b.owner_phone || '—'}`;
    $('#panel-address').textContent = b.address;

    // Phase status badges in header
    const badges = [
      `<span class="status-badge ${statusClass(b.phase1_status)}">Phase 1: ${statusLabel(b.phase1_status)}</span>`,
      `<span class="status-badge ${statusClass(b.phase2_status)}">Phase 2: ${statusLabel(b.phase2_status)}</span>`,
    ];
    if (b.is_flagged) badges.push(`<span class="status-badge status-pending">⚠️ GPS Flagged</span>`);
    $('#panel-badges').innerHTML = badges.join('');
  },

  switchTab(tab) {
    STATE.currentDetailTab = tab;
    $$('.panel-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
    const b = STATE.currentBuilding;
    if (!b) return;

    const body = $('#panel-body');
    switch (tab) {
      case 'phase1':   body.innerHTML = this._renderPhase1(b, MOCK.phase1Detail); break;
      case 'phase2':   body.innerHTML = this._renderPhase2(b, MOCK.phase2Detail, MOCK.defects); break;
      case 'defects':  body.innerHTML = this._renderDefects(MOCK.defects); break;
      case 'photos':   body.innerHTML = this._renderPhotos(b); break;
      case 'gps':      body.innerHTML = this._renderGPS(b); break;
      case 'sign':     body.innerHTML = this._renderSignatures(MOCK.signatures, b); break;
      case 'audit':    body.innerHTML = this._renderAudit(MOCK.auditLogs); break;
      case 'building': body.innerHTML = this._renderBuildingInfo(b); break;
    }

    // Wire interactive elements after render
    this._wireTabEvents(tab, b);
  },

  _renderBuildingInfo(b) {
    return `
      <div class="section-label">THÔNG TIN CÔNG TRÌNH</div>
      <div class="card">
        <div class="field-grid">
          <div class="field-item"><div class="field-label">Mã căn</div><div class="field-value" style="font-family:monospace;color:var(--primary-light)">${escHtml(b.building_code)}</div></div>
          <div class="field-item"><div class="field-label">Chainage</div><div class="field-value">${escHtml(b.chainage_km || '—')}</div></div>
          <div class="field-item"><div class="field-label">Khoảng cách Metro</div><div class="field-value">${b.distance_to_metro_m?.toFixed(1) || '—'} m</div></div>
          <div class="field-item"><div class="field-label">Chủ hộ</div><div class="field-value">${escHtml(b.owner_name)}</div></div>
          <div class="field-item"><div class="field-label">Điện thoại</div><div class="field-value">${escHtml(b.owner_phone || '—')}</div></div>
          <div class="field-item"><div class="field-label">Địa chỉ</div><div class="field-value">${escHtml(b.address)}</div></div>
          <div class="field-item"><div class="field-label">Công năng</div><div class="field-value">${escHtml(b.building_use || '—')}</div></div>
          <div class="field-item"><div class="field-label">Nhóm quan trọng</div><div class="field-value">${escHtml(b.importance_group || '—')}</div></div>
          <div class="field-item"><div class="field-label">Số tầng</div><div class="field-value">${b.storeys_above} tầng${b.storeys_basement ? ' + hầm' : ''}</div></div>
          <div class="field-item"><div class="field-label">Năm xây</div><div class="field-value">${b.construction_year || '—'}</div></div>
          <div class="field-item"><div class="field-label">Hệ kết cấu</div><div class="field-value">${escHtml(b.structural_system || '—')}</div></div>
          <div class="field-item"><div class="field-label">Loại móng</div><div class="field-value">${escHtml(b.foundation_type || '—')}</div></div>
          <div class="field-item"><div class="field-label">Hạng Móng</div><div class="field-value" style="font-weight:800;font-size:18px;color:var(--warning)">Loại ${b.foundation_cat || '—'}</div></div>
        </div>
      </div>
    `;
  },

  _renderPhase1(b, p1) {
    const ecsColor = ecsColorClass(p1.ecs_class);
    const ecsMax = 24;
    const circum = 2 * Math.PI * 28;
    const offset = circum - (p1.ecs_total_score / ecsMax) * circum;

    const eRows = ['e1','e2','e3','e4','e5','e6'].map(k => {
      const v = p1[`${k}_structural_cracks`] ?? p1[`${k}_wall_masonry_cracks`] ?? p1[`${k}_deformation_tilt`] ?? p1[`${k}_water_seepage_deterioration`] ?? p1[`${k}_history_integrity`] ?? p1[`${k}_functionality_state`] ?? 0;
      const label = k.toUpperCase();
      const val = p1[Object.keys(p1).find(x => x.startsWith(k + '_'))] ?? 0;
      const pct = (val / 4) * 100;
      const c = val >= 3 ? '#EF4444' : val >= 2 ? '#F97316' : val >= 1 ? '#F59E0B' : '#10B981';
      return `<div class="ecs-bar-row">
        <div class="ecs-bar-label">${label}</div>
        <div class="ecs-bar-track"><div class="ecs-bar-fill" style="width:${pct}%;background:${c}"></div></div>
        <div class="ecs-bar-val">${val}</div>
      </div>`;
    }).join('');

    const bra = p1.bra_result;
    const braRows = [
      ['VERY_HIGH', 'HIGH', 'HIGH', 'VERY_HIGH', 'VERY_HIGH'],
      ['HIGH', 'MEDIUM', 'HIGH', 'HIGH', 'VERY_HIGH'],
      ['MEDIUM', 'LOW', 'MEDIUM', 'MEDIUM', 'HIGH'],
      ['LOW', 'LOW', 'LOW', 'MEDIUM', 'HIGH'],
    ];
    const impacts = ['I1_LOW', 'I2_MEDIUM', 'I3_HIGH', 'I4_VERY_HIGH'];
    const viRows = ['VERY_HIGH', 'HIGH', 'MEDIUM', 'LOW'];

    const matrixHtml = viRows.map((vr, ri) => {
      const cols = impacts.map((ic, ci) => {
        const val = braRows[ri][ci + 1];
        const isActive = vr === p1.vi_class?.toUpperCase().replace('VERYHIGH','VERY_HIGH') && ic === p1.construction_impact_class;
        return `<div class="bra-cell ${braColorClass(val)} ${isActive ? 'active' : ''}" title="${vr} × ${ic} = ${val}">${val.replace('VERY_HIGH','V.HIGH')}</div>`;
      }).join('');
      return `<div class="bra-cell row-label" style="font-size:9px;">${vr.replace('VERY_HIGH','V.HIGH')}</div>${cols}`;
    }).join('');

    return `
      ${p1.structural_flag === 'HIGH' || p1.structural_flag === 'CRITICAL' ? `
        <div class="critical-alert-banner">
          <div class="critical-alert-icon">🏗️</div>
          <div>
            <div class="critical-alert-title">STRUCTURAL OVERRIDE ĐÃ KÍCH HOẠT</div>
            <div class="critical-alert-msg">Hư hỏng kết cấu chịu lực nghiêm trọng (E1/E3 ≥ 3). ECS bị nâng lên DEFICIENT bất kể tổng điểm.</div>
          </div>
        </div>` : ''}

      <div class="section-label">ĐIỂM SỐ ECS (E1-E6)</div>
      <div class="card">
        <div class="ecs-gauge-container">
          <div class="ecs-ring-wrap">
            <svg viewBox="0 0 64 64">
              <circle class="ecs-ring-bg" cx="32" cy="32" r="28"/>
              <circle class="ecs-ring-fill" cx="32" cy="32" r="28" stroke="${ecsColor}"
                stroke-dasharray="${circum}" stroke-dashoffset="${offset}"/>
            </svg>
            <div class="ecs-ring-label">
              <div class="ecs-ring-num" style="color:${ecsColor}">${p1.ecs_total_score}</div>
              <div class="ecs-ring-max">/24</div>
            </div>
          </div>
          <div class="ecs-details">
            <div class="ecs-class-badge" style="background:${ecsColor}20;color:${ecsColor};border:1px solid ${ecsColor}40">${ecsLabel(p1.ecs_class)}</div>
            ${eRows}
          </div>
        </div>
      </div>

      <div class="section-label">CHỈ SỐ DỄ TỔN THƯƠNG VI</div>
      <div class="card">
        <div class="field-grid">
          ${['v1','v2','v3','v4','v5','v6'].map(v => {
            const val = p1[`${v}_use_consequence`] ?? p1[`${v}_structural_fragility`] ?? p1[`${v}_foundation_uncertainty`] ?? p1[`${v}_age_modifications`] ?? p1[`${v}_existing_condition`] ?? p1[`${v}_sensitive_equipment`] ?? '—';
            const isAuto = v === 'v3' || v === 'v5';
            return `<div class="field-item"><div class="field-label">${v.toUpperCase()} ${isAuto ? '⚡ Auto' : ''}</div><div class="field-value" style="${isAuto ? 'color:var(--primary-light)' : ''}">${val}</div></div>`;
          }).join('')}
          <div class="field-item"><div class="field-label">VI Trung bình</div><div class="field-value" style="font-size:18px;font-weight:800">${p1.vi_average?.toFixed(2) ?? '—'}</div></div>
          <div class="field-item"><div class="field-label">VI Class</div>
            <div class="field-value"><span class="status-badge" style="background:${ecsColor}20;color:${ecsColor};border:1px solid ${ecsColor}40">${viLabel(p1.vi_class)}</span></div>
          </div>
        </div>
      </div>

      <div class="section-label">MA TRẬN RỦI RO BRA</div>
      <div class="card">
        <div class="bra-matrix">
          <div class="bra-cell header"></div>
          <div class="bra-cell header">I1 Thấp</div>
          <div class="bra-cell header">I2 TB</div>
          <div class="bra-cell header">I3 Cao</div>
          <div class="bra-cell header">I4 Rất cao</div>
          ${matrixHtml}
        </div>
        <div style="margin-top:10px;padding:10px;background:var(--bg-2);border-radius:8px;">
          <div style="font-size:10px;color:var(--text-3);margin-bottom:4px;">KẾT QUẢ BRA & HÀNH ĐỘNG</div>
          <div style="display:flex;align-items:center;gap:10px;">
            <span class="bra-cell ${braColorClass(bra)}" style="padding:6px 14px;font-size:13px;">${braLabel(bra)}</span>
            <span style="font-size:11px;color:var(--text-2)">${bra === 'VERY_HIGH' ? '⚠️ Đánh giá chuyên sâu bắt buộc — Hold Point thi công' : bra === 'HIGH' ? 'Khảo sát kết cấu & móng chi tiết' : bra === 'MEDIUM' ? 'Thiết lập đầy đủ BCS & quan trắc' : 'Lưu hồ sơ nền, quan trắc định kỳ'}</span>
          </div>
        </div>
      </div>

      <div class="section-label">THÔNG TIN KHẢO SÁT</div>
      <div class="card">
        <div class="field-grid">
          <div class="field-item"><div class="field-label">Cán bộ KS</div><div class="field-value">${escHtml(p1.surveyor_name || '—')}</div></div>
          <div class="field-item"><div class="field-label">Ngày nộp</div><div class="field-value">${formatDate(p1.submitted_at)}</div></div>
          <div class="field-item"><div class="field-label">Ngày duyệt</div><div class="field-value">${formatDate(p1.approved_at)}</div></div>
          <div class="field-item"><div class="field-label">Trạng thái</div><div class="field-value"><span class="status-badge ${statusClass(b.phase1_status)}">${statusLabel(b.phase1_status)}</span></div></div>
        </div>
      </div>
    `;
  },

  _renderPhase2(b, p2, defects) {
    const newD = defects.filter(d => d.comparison_with_phase1 === 'NEWLY_OBSERVED').length;
    const worseD = defects.filter(d => ['DEVELOPED_WIDER','DEVELOPED_LONGER'].includes(d.comparison_with_phase1)).length;

    return `
      ${p2.has_critical_damage_alert ? `
        <div class="critical-alert-banner">
          <div class="critical-alert-icon">🚨</div>
          <div>
            <div class="critical-alert-title">BÁO CÁO NGUY CẤP TỪ CÁN BỘ HIỆN TRƯỜNG</div>
            <div class="critical-alert-msg">Cán bộ khảo sát ghi nhận dấu hiệu nguy cấp. Yêu cầu kiểm tra khẩn cấp trước khi thi công.</div>
          </div>
        </div>` : ''}

      <div class="section-label">THÔNG TIN CHUNG PHASE 2</div>
      <div class="card">
        <div class="field-grid">
          <div class="field-item"><div class="field-label">Tiếp cận</div><div class="field-value">${p2.access_status === 'FULL' ? '✅ Đầy đủ' : '⚠️ ' + p2.access_status}</div></div>
          <div class="field-item"><div class="field-label">Nhận định CB</div>
            <div class="field-value"><span class="status-badge ${p2.overall_condition_summary === 'STABLE' ? 'status-approved' : p2.overall_condition_summary === 'MONITOR' ? 'status-pending' : 'status-rejected'}">${p2.overall_condition_summary}</span>
          </div></div>
          <div class="field-item"><div class="field-label">Nghiêng đo</div><div class="field-value">${p2.tilt_angle_degree != null ? p2.tilt_angle_degree + '° (' + (p2.tilt_direction || '') + ')' : '—'}</div></div>
          <div class="field-item"><div class="field-label">Phương pháp đo</div><div class="field-value">${escHtml(p2.tilt_measurement_method || '—')}</div></div>
          <div class="field-item full"><div class="field-label">Khu vực khảo sát</div><div class="field-value">${(p2.surveyed_areas || []).join(' · ')}</div></div>
          ${p2.repairs_since_phase1 ? `<div class="field-item full"><div class="field-label">Sửa chữa từ GĐ1</div><div class="field-value" style="color:var(--warning)">${escHtml(p2.repairs_description || '—')}</div></div>` : ''}
        </div>
      </div>

      <div class="section-label">SỔ KHUYẾT TẬT — TỔNG QUAN</div>
      <div class="card">
        <div class="field-grid">
          <div class="field-item"><div class="field-label">Tổng khuyết tật</div><div class="field-value" style="font-size:22px;font-weight:800;">${defects.length}</div></div>
          <div class="field-item"><div class="field-label">Mới phát sinh 🆕</div><div class="field-value" style="font-size:22px;font-weight:800;color:var(--info)">${newD}</div></div>
          <div class="field-item"><div class="field-label">Nặng hơn ⚠️</div><div class="field-value" style="font-size:22px;font-weight:800;color:${worseD > 0 ? 'var(--warning)' : 'var(--text-3)'}">${worseD}</div></div>
          <div class="field-item"><div class="field-label">Bản vẽ vẽ tay</div><div class="field-value">${p2.sketch_photo_url ? '✅ Đã có' : '❌ Chưa có'}</div></div>
        </div>
      </div>

      ${p2.sketch_photo_url ? `
        <div class="section-label">BẢN VẼ MẶT BẰNG VẼ TAY</div>
        <div class="sketch-viewer">
          <img src="${p2.sketch_photo_url}" alt="Bản vẽ vẽ tay" />
          ${defects.filter(d => d.sketch_pin_x_percent != null).map(d => `
            <div class="sketch-pin" style="left:${d.sketch_pin_x_percent}%;top:${d.sketch_pin_y_percent}%">
              <div class="sketch-pin-marker">${d.defect_code}</div>
              <div class="sketch-pin-label">${d.defect_code} · ${escHtml(d.floor_name)}</div>
            </div>
          `).join('')}
        </div>` : ''}
    `;
  },

  _renderDefects(defects) {
    if (!defects.length) {
      return `<div class="empty-state"><div class="empty-state-icon">📋</div><div class="empty-state-title">Chưa có khuyết tật nào</div></div>`;
    }

    const rows = defects.map(d => {
      const widthDelta = d.delta_width_change_mm != null
        ? `<span style="color:${d.delta_width_change_mm > 0 ? 'var(--danger)' : 'var(--success)'}"> (Δ${d.delta_width_change_mm > 0 ? '+' : ''}${d.delta_width_change_mm.toFixed(1)}mm)</span>` : '';
      return `
        <tr>
          <td><span class="defect-code">${escHtml(d.defect_code)}</span></td>
          <td>${escHtml(d.floor_name)} · ${escHtml(d.room_or_zone)}</td>
          <td>${escHtml(d.structural_element)} / ${escHtml(d.defect_type)}</td>
          <td>${d.max_crack_width_mm != null ? `<strong>${d.max_crack_width_mm}</strong> mm${widthDelta}` : '—'}</td>
          <td>${d.crack_length_m != null ? d.crack_length_m + ' m' : '—'}</td>
          <td><span class="delta-badge ${deltaClass(d.comparison_with_phase1)}">${deltaLabel(d.comparison_with_phase1)}</span></td>
          <td><span class="delta-badge ${d.activity_status === 'ACTIVE_DEVELOPING' ? 'delta-worse' : d.activity_status === 'STATIC' ? 'delta-same' : 'delta-repair'}">${d.activity_status === 'ACTIVE_DEVELOPING' ? '⚠️ Đang ptriển' : d.activity_status === 'STATIC' ? '— Tĩnh' : d.activity_status === 'REPAIRED_RECRACKED' ? '↺ Đã sửa/nứt lại' : '?'}</span></td>
          <td style="color:var(--text-3);font-size:10px;">${escHtml(d.defect_notes || '—')}</td>
        </tr>
      `;
    }).join('');

    return `
      <div class="section-label">SỔ KHUYẾT TẬT D-xx</div>
      <div style="overflow-x:auto;border:1px solid var(--border);border-radius:var(--radius);">
        <table class="defect-table">
          <thead><tr>
            <th>Mã D</th><th>Vị trí</th><th>Loại</th><th>w_max</th><th>Dài</th><th>So sánh GĐ1</th><th>Tình trạng</th><th>Ghi chú</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  },

  _renderPhotos(b) {
    return `
      <div class="section-label">ẢNH TOÀN CẢNH & CẬN CẢNH (CU/CTX)</div>
      <div class="section-label" style="margin-top:12px">D-01 — Nứt chân cột trục A</div>
      <div class="photo-split">
        <div class="photo-slot">
          <div class="photo-empty"><div style="font-size:28px">📷</div><span>CTX — Toàn cảnh<br><small>(Chưa có ảnh)</small></span></div>
          <span class="photo-label">CTX</span>
        </div>
        <div class="photo-slot">
          <div class="photo-empty"><div style="font-size:28px">🔍</div><span>CU — Cận cảnh + Thước đo<br><small>(Chưa có ảnh)</small></span></div>
          <span class="photo-label">CU</span>
          <span class="ruler-badge">📏 Thước</span>
        </div>
      </div>

      <div class="section-label" style="margin-top:12px">Ảnh Tổng quan Công trình</div>
      <div class="photo-split">
        <div class="photo-slot"><div class="photo-empty"><div style="font-size:28px">🏠</div><span>Mặt tiền (P01)</span></div><span class="photo-label">P01</span></div>
        <div class="photo-slot"><div class="photo-empty"><div style="font-size:28px">🏚️</div><span>Số nhà (P02)</span></div><span class="photo-label">P02</span></div>
      </div>
      <p style="font-size:11px;color:var(--text-3);margin-top:12px;text-align:center">Ảnh sẽ hiển thị sau khi cán bộ upload từ Mobile App</p>
    `;
  },

  _renderGPS(b) {
    const dev = b.deviation_meters || 0;
    const flagged = b.is_flagged;
    return `
      <div class="section-label">KIỂM TRA GPS KHÁNG GIAN LẬN</div>
      <div class="card">
        <div class="gps-radar">
          <div class="gps-radar-circle">
            <div class="gps-radar-rings"></div>
            <div class="gps-hw-dot"></div>
            <div class="gps-pin-dot" style="left:${50 + Math.min(dev,50)/50*30}%;top:${50 - Math.min(dev,50)/50*15}%;"></div>
          </div>
          <div class="gps-deviation-info">
            <div style="font-size:10px;color:var(--text-3);margin-bottom:2px">SAI LỆCH GPS (DUAL)</div>
            <div class="deviation-val" style="color:${flagged ? 'var(--danger)' : dev > 20 ? 'var(--warning)' : 'var(--success)'}">${dev.toFixed(1)} m</div>
            <div class="deviation-flag ${flagged ? 'flag-danger' : dev > 20 ? 'flag-warn' : 'flag-ok'}">
              ${flagged ? '🚨 CẢNH BÁO GPS' : dev > 20 ? '⚠️ Lệch đáng chú ý' : '✅ Trong ngưỡng cho phép'}
            </div>
            <div style="font-size:10px;color:var(--text-3);margin-top:6px">Ngưỡng cảnh báo: 50m theo WGS84</div>
          </div>
        </div>
      </div>

      <div class="section-label">TỌA ĐỘ CHI TIẾT</div>
      <div class="card">
        <div class="field-grid">
          <div class="field-item">
            <div class="field-label">🔵 GPS Phần cứng (Ngầm)</div>
            <div class="field-value" style="font-family:monospace;font-size:11px">
              ${b.pin_geometry?.coordinates ? `${(b.pin_geometry.coordinates[1]).toFixed(6)}, ${(b.pin_geometry.coordinates[0]).toFixed(6)}` : '—'}
            </div>
          </div>
          <div class="field-item">
            <div class="field-label">🟡 GPS Ghim Tâm Mái</div>
            <div class="field-value" style="font-family:monospace;font-size:11px">
              ${b.pin_geometry?.coordinates ? `${(b.pin_geometry.coordinates[1] + 0.0002).toFixed(6)}, ${(b.pin_geometry.coordinates[0] + 0.0001).toFixed(6)}` : '—'}
            </div>
          </div>
          <div class="field-item"><div class="field-label">Chainage</div><div class="field-value">${escHtml(b.chainage_km || '—')}</div></div>
          <div class="field-item"><div class="field-label">Khoảng cách Metro</div><div class="field-value">${b.distance_to_metro_m?.toFixed(1) || '—'} m</div></div>
        </div>
      </div>
    `;
  },

  _renderSignatures(sigs, b) {
    const roleLabels = {
      OWNER_RESIDENT:  ['Chủ sở hữu / Người sử dụng', 'MOBILE_APP', false],
      SURVEYOR:        ['Cán bộ khảo sát', 'MOBILE_APP', false],
      CONTRACTOR:      ['Đại diện Nhà thầu', 'WEB_PORTAL', true],
      LOCAL_AUTHORITY: ['Đại diện Chính quyền địa phương', 'WEB_PORTAL', true],
    };

    const slots = sigs.map(s => {
      const [label, platform, isWeb] = roleLabels[s.sign_role] || [s.sign_role, '—', false];
      const signed = !!s.signer_full_name && !s.is_refused;
      return `
        <div class="signature-slot ${signed ? 'signed' : isWeb ? 'web-sign' : 'pending'}">
          <div class="sig-role">${label}</div>
          ${signed ? `
            <div class="sig-name">✅ ${escHtml(s.signer_full_name)}</div>
            <div class="sig-status" style="color:var(--text-3)">${escHtml(s.signer_title || '')} · ${formatDate(s.signed_at)}</div>
            <div class="sig-status" style="color:var(--text-3);font-size:9px">${platform === 'MOBILE_APP' ? '📱 Ký tại hiện trường' : '🖥️ Ký qua Web Portal'}</div>
            <div class="sig-pad"><span style="color:var(--success);font-size:11px">Đã ký — Chữ ký được lưu</span></div>
          ` : s.is_refused ? `
            <div class="sig-name" style="color:var(--danger)">❌ Từ chối ký</div>
            <div class="sig-status" style="color:var(--text-3)">${escHtml(s.refusal_reason || '')}</div>
          ` : isWeb ? `
            <div class="sig-name" style="color:var(--text-3)">Chưa ký</div>
            <div class="sig-pad" id="sig-pad-${s.sign_role}"><span style="color:var(--text-3);font-size:11px">Nhấp để mở bảng ký số</span></div>
            <button class="btn-web-sign" data-role="${s.sign_role}" id="btn-sign-${s.sign_role}">✍️ Ký qua Web Portal</button>
          ` : `
            <div class="sig-name" style="color:var(--warning)">⏳ Chờ ký từ Mobile App</div>
            <div class="sig-status" style="color:var(--text-3);font-size:10px">Chủ hộ / Cán bộ ký tại hiện trường qua Mobile App</div>
          `}
        </div>
      `;
    }).join('');

    return `
      <div class="section-label">CHỮ KÝ SỐ 4 BÊN</div>
      <div class="signatures-grid">${slots}</div>
      <div style="margin-top:12px;padding:10px;background:var(--bg-3);border-radius:8px;font-size:10.5px;color:var(--text-3)">
        📱 Chủ hộ & Cán bộ ký tại hiện trường qua Mobile App · 🖥️ Nhà thầu & Chính quyền ký qua Web Portal sau khi hồ sơ được phê duyệt
      </div>
    `;
  },

  _renderAudit(logs) {
    if (!logs.length) return `<div class="empty-state"><div class="empty-state-icon">📝</div><div class="empty-state-title">Chưa có lịch sử</div></div>`;

    const iconMap = {
      PHASE1_APPROVE: 'approve', PHASE2_APPROVE: 'approve',
      PHASE1_REJECT: 'reject',  PHASE2_REJECT: 'reject',
      PHASE1_SUBMIT: 'submit',  PHASE2_SUBMIT: 'submit',
      SIGNATURE_MOBILE: 'sign', SIGNATURE_WEB: 'sign',
      CRITICAL_DAMAGE_ALERT: 'alert',
    };

    const events = logs.map(l => `
      <div class="audit-event ${iconMap[l.action] || 'submit'}">
        <div class="audit-time">${formatDate(l.created_at)}</div>
        <div class="audit-action">${escHtml(l.action.replace(/_/g,' '))} — ${escHtml(l.user || '')}</div>
        ${l.details ? `<div class="audit-detail">${escHtml(l.details)}</div>` : ''}
      </div>
    `).join('');

    return `
      <div class="section-label">NHẬT KÝ THAO TÁC</div>
      <div class="audit-timeline">${events}</div>
    `;
  },

  _wireTabEvents(tab, b) {
    // Approve / Reject buttons in action-bar
    $('#btn-approve')?.addEventListener('click', () => Actions.approvePhase(b));
    $('#btn-reject')?.addEventListener('click', () => Modal.openReject(b));

    // Web signature buttons
    $$('[id^="btn-sign-"]').forEach(btn => {
      btn.addEventListener('click', () => Modal.openSignature(btn.dataset.role, b));
    });
  },
};

// ============================================================================
// ACTIONS
// ============================================================================
const Actions = {
  async approvePhase(b) {
    const phase = b.phase2_status === 'SUBMITTED' ? 'phase2' : b.phase1_status === 'SUBMITTED' ? 'phase1' : null;
    if (!phase) { showToast('Không có hồ sơ nào cần phê duyệt', 'info'); return; }

    const btn = $('#btn-approve');
    if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Đang xử lý...'; }

    try {
      if (phase === 'phase1') await API.approvePhase1(b.id);
      else await API.approvePhase2(b.id);

      // Update local state
      if (phase === 'phase1') b.phase1_status = 'APPROVED';
      else b.phase2_status = 'APPROVED';

      showToast(`✅ Đã PHÊ DUYỆT ${phase.toUpperCase()} công trình ${b.building_code}`, 'success');
      BuildingList.render(BuildingList.filter($('#search-input')?.value || '', STATE.filterStatus));
      BuildingList.updateKPIs(STATE.buildings);
      MapModule.renderMarkers(STATE.buildings);
      DetailPanel._renderHeader(b);
      DetailPanel.switchTab(STATE.currentDetailTab);
    } catch (e) {
      showToast('Lỗi: ' + e.message, 'error');
    } finally {
      if (btn) { btn.disabled = false; btn.innerHTML = '✅ Phê Duyệt'; }
    }
  },
};

// ============================================================================
// MODAL MODULE
// ============================================================================
const Modal = {
  openReject(b) {
    const phase = b.phase2_status === 'SUBMITTED' ? 'Phase 2' : 'Phase 1';
    $('#modal-title').textContent = `Từ chối hồ sơ ${phase} — ${b.building_code}`;
    $('#modal-body').innerHTML = `
      <label class="form-label">Lý do từ chối (tối thiểu 10 ký tự)</label>
      <textarea id="reject-reason" class="form-control" rows="4" placeholder="VD: Ảnh chụp không đủ ánh sáng. Thiếu bức ảnh D-01 CU với thước đo mm. Yêu cầu chụp lại tại hiện trường..."></textarea>
    `;
    $('#modal-footer').innerHTML = `
      <button class="btn btn-ghost" onclick="Modal.close()">Hủy</button>
      <button class="btn btn-danger" id="confirm-reject-btn">❌ Xác nhận Từ chối</button>
    `;
    $('#confirm-reject-btn').addEventListener('click', async () => {
      const reason = $('#reject-reason').value.trim();
      if (reason.length < 10) { showToast('Lý do quá ngắn (tối thiểu 10 ký tự)', 'warning'); return; }
      try {
        if (b.phase2_status === 'SUBMITTED') await API.rejectPhase2(b.id, reason);
        else await API.rejectPhase1(b.id, reason);

        if (b.phase2_status === 'SUBMITTED') b.phase2_status = 'REJECTED';
        else b.phase1_status = 'REJECTED';

        showToast(`Hồ sơ ${b.building_code} đã bị TỪ CHỐI`, 'warning');
        Modal.close();
        BuildingList.render(BuildingList.filter($('#search-input')?.value || '', STATE.filterStatus));
        DetailPanel._renderHeader(b);
        DetailPanel.switchTab(STATE.currentDetailTab);
      } catch(e) { showToast('Lỗi: ' + e.message, 'error'); }
    });
    this.open();
  },

  openSignature(role, b) {
    const labels = { CONTRACTOR: 'Đại diện Nhà thầu thi công', LOCAL_AUTHORITY: 'Đại diện Chính quyền / Tổ dân phố' };
    $('#modal-title').textContent = `✍️ Ký số — ${labels[role] || role}`;
    $('#modal-body').innerHTML = `
      <div style="margin-bottom:14px">
        <label class="form-label">Họ và tên người ký</label>
        <input type="text" id="sig-name" class="form-control" placeholder="Nguyễn Văn A">
      </div>
      <div style="margin-bottom:14px">
        <label class="form-label">Chức danh</label>
        <input type="text" id="sig-title" class="form-control" placeholder="Kỹ sư Giám sát thi công">
      </div>
      <div style="margin-bottom:14px">
        <label class="form-label">Ký vào đây (bảng vẽ tay)</label>
        <canvas id="sig-canvas" width="440" height="140" style="background:#1E2535;border:1px solid var(--border);border-radius:8px;cursor:crosshair;display:block;width:100%;touch-action:none;"></canvas>
      </div>
      <div style="text-align:right">
        <button class="btn btn-ghost btn-sm" onclick="Modal._clearCanvas()">Xóa</button>
      </div>
    `;
    $('#modal-footer').innerHTML = `
      <button class="btn btn-ghost" onclick="Modal.close()">Hủy</button>
      <button class="btn btn-secondary" id="confirm-sign-btn">✅ Xác nhận Ký</button>
    `;

    this.open();
    this._initCanvas();

    $('#confirm-sign-btn').addEventListener('click', async () => {
      const name = $('#sig-name').value.trim();
      const title = $('#sig-title').value.trim();
      if (!name) { showToast('Vui lòng nhập họ tên người ký', 'warning'); return; }

      const canvas = $('#sig-canvas');
      const dataUrl = canvas.toDataURL('image/png');

      try {
        await API.signWeb(b.id, {
          phase2Id: STATE.currentBuilding?.id,
          signRole: role,
          signerFullName: name,
          signerTitle: title,
          signatureImageUrl: dataUrl,
        });

        // Update mock
        const sig = MOCK.signatures.find(s => s.sign_role === role);
        if (sig) { sig.signer_full_name = name; sig.signer_title = title; sig.signed_at = new Date().toISOString(); }

        showToast(`✅ Chữ ký ${labels[role]} đã được lưu thành công!`, 'success');
        Modal.close();
        DetailPanel.switchTab('sign');
      } catch(e) { showToast('Lỗi lưu chữ ký: ' + e.message, 'error'); }
    });
  },

  _canvas: null, _ctx: null, _drawing: false, _lastX: 0, _lastY: 0,

  _initCanvas() {
    const c = $('#sig-canvas');
    if (!c) return;
    this._ctx = c.getContext('2d');
    this._ctx.strokeStyle = '#F1F5F9';
    this._ctx.lineWidth = 2;
    this._ctx.lineCap = 'round';
    this._ctx.lineJoin = 'round';

    const getPos = (e) => {
      const rect = c.getBoundingClientRect();
      const scaleX = c.width / rect.width;
      const scaleY = c.height / rect.height;
      const src = e.touches ? e.touches[0] : e;
      return { x: (src.clientX - rect.left) * scaleX, y: (src.clientY - rect.top) * scaleY };
    };

    const start = (e) => { e.preventDefault(); this._drawing = true; const p = getPos(e); this._lastX = p.x; this._lastY = p.y; };
    const draw  = (e) => {
      e.preventDefault();
      if (!this._drawing) return;
      const p = getPos(e);
      this._ctx.beginPath();
      this._ctx.moveTo(this._lastX, this._lastY);
      this._ctx.lineTo(p.x, p.y);
      this._ctx.stroke();
      this._lastX = p.x; this._lastY = p.y;
    };
    const stop  = () => this._drawing = false;

    c.addEventListener('mousedown',  start); c.addEventListener('mousemove', draw);
    c.addEventListener('mouseup',    stop);  c.addEventListener('mouseleave', stop);
    c.addEventListener('touchstart', start); c.addEventListener('touchmove', draw);
    c.addEventListener('touchend',   stop);
  },

  _clearCanvas() {
    const c = $('#sig-canvas');
    if (c && this._ctx) this._ctx.clearRect(0, 0, c.width, c.height);
  },

  open() { $('#modal-overlay').classList.add('open'); },
  close() { $('#modal-overlay').classList.remove('open'); this._clearCanvas(); },
};

// ============================================================================
// LIST VIEW MODULE (Table Review)
// ============================================================================
const ListView = {
  render(buildings) {
    const rows = buildings.map(b => `
      <tr data-id="${b.id}">
        <td><span style="font-family:monospace;font-weight:700;color:var(--primary-light)">${escHtml(b.building_code)}</span></td>
        <td>${escHtml(b.owner_name)}</td>
        <td style="font-size:11px;color:var(--text-3)">${escHtml(b.address)}</td>
        <td>${escHtml(b.chainage_km || '—')}</td>
        <td>${b.distance_to_metro_m?.toFixed(0) || '—'} m</td>
        <td><span class="status-badge ${statusClass(b.phase1_status)}">${statusLabel(b.phase1_status)}</span></td>
        <td><span class="status-badge ${statusClass(b.phase2_status)}">${statusLabel(b.phase2_status)}</span></td>
        <td><span style="color:${b.is_flagged ? 'var(--warning)' : b.deviation_meters > 20 ? 'var(--warning)' : 'var(--success)'}">${b.deviation_meters?.toFixed(1)} m ${b.is_flagged ? '⚠️' : ''}</span></td>
      </tr>
    `).join('');

    const table = $('[data-table="review"]');
    if (table) {
      table.querySelector('tbody').innerHTML = rows || '<tr><td colspan="8" style="text-align:center;color:var(--text-3)">Không có dữ liệu</td></tr>';
      $$('[data-table="review"] tbody tr').forEach(row => {
        row.addEventListener('click', () => {
          const b = STATE.buildings.find(x => x.id === row.dataset.id);
          if (b) DetailPanel.open(b);
        });
      });
    }
  },
};

// ============================================================================
// MAIN INIT
// ============================================================================
document.addEventListener('DOMContentLoaded', async () => {
  // Load data
  STATE.buildings = await API.getBuildings();
  STATE.user = MOCK.user;
  $('#user-name').textContent = STATE.user.fullName;
  $('#user-role-badge').textContent = STATE.user.role;
  $('#conn-text').textContent = 'Demo Mode';

  // Initialize modules
  BuildingList.updateKPIs(STATE.buildings);
  BuildingList.render(STATE.buildings);
  ListView.render(STATE.buildings);
  MapModule.init();

  // Search
  $('#search-input').addEventListener('input', e => {
    const filtered = BuildingList.filter(e.target.value, STATE.filterStatus);
    BuildingList.render(filtered);
    MapModule.renderMarkers(filtered);
    ListView.render(filtered);
  });

  // Filter tabs
  $$('.filter-tab-mini').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.filter-tab-mini').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      STATE.filterStatus = btn.dataset.filter;
      const keyword = $('#search-input').value;
      const filtered = BuildingList.filter(keyword, STATE.filterStatus);
      BuildingList.render(filtered);
      MapModule.renderMarkers(filtered);
      ListView.render(filtered);
    });
  });

  // Nav tabs
  $$('.nav-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.nav-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      STATE.currentTab = btn.dataset.tab;
      $$('.page-panel').forEach(p => p.classList.remove('active'));
      $(`#panel-${btn.dataset.tab}`)?.classList.add('active');
      if (btn.dataset.tab === 'map') { setTimeout(() => STATE.map?.invalidateSize(), 100); }
    });
  });

  // Panel tabs
  $$('.panel-tab').forEach(btn => {
    btn.addEventListener('click', () => DetailPanel.switchTab(btn.dataset.tab));
  });

  // Panel close
  $('#panel-close-btn').addEventListener('click', () => DetailPanel.close());

  // Modal close
  $('#modal-overlay').addEventListener('click', e => { if (e.target === $('#modal-overlay')) Modal.close(); });
  $('#modal-close-btn').addEventListener('click', () => Modal.close());

  // Action buttons in panel
  $('#btn-approve').addEventListener('click', () => { if (STATE.currentBuilding) Actions.approvePhase(STATE.currentBuilding); });
  $('#btn-reject').addEventListener('click', () => { if (STATE.currentBuilding) Modal.openReject(STATE.currentBuilding); });

  // Map controls
  $('#map-zoom-in')?.addEventListener('click', () => STATE.map?.zoomIn());
  $('#map-zoom-out')?.addEventListener('click', () => STATE.map?.zoomOut());
  $('#map-reset')?.addEventListener('click', () => STATE.map?.setView(CONFIG.MAP_CENTER, CONFIG.MAP_ZOOM));

  // Show pending badge
  const pendingCount = STATE.buildings.filter(b => b.phase1_status === 'SUBMITTED' || b.phase2_status === 'SUBMITTED').length;
  if (pendingCount > 0) {
    $$('[data-tab="list"] .tab-badge').forEach(el => el.textContent = pendingCount);
  }
});
