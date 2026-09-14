/**
 * MAIN APP CONTROLLER, VIEW SWITCHER & APPROVAL WORKFLOW - LIGHT THEME READY
 */

document.addEventListener('DOMContentLoaded', () => {
  initApp();
});

let currentActiveBuildingId = null;

function initApp() {
  initAdminMap();
  initSurveyorWorkflow();
  initViewSwitcher();
  initAdminPanelToggle();
  updateAdminStats();

  // Handle Approval actions
  document.getElementById('btn-approve-survey')?.addEventListener('click', approveCurrentSurvey);
  document.getElementById('btn-reject-survey')?.addEventListener('click', rejectCurrentSurvey);
  document.getElementById('btn-close-drawer')?.addEventListener('click', closeApprovalDrawer);

  // Set default split view
  setViewMode('split');
}

// ---------------- ADMIN PANEL COLLAPSIBLE TOGGLE ----------------

function initAdminPanelToggle() {
  const toggleBtn = document.getElementById('btn-toggle-admin-panel');
  const panel = document.getElementById('admin-stats-panel');
  const closeBtn = document.getElementById('btn-close-stats-panel');
  const arrow = document.getElementById('panel-toggle-arrow');

  if (!toggleBtn || !panel) return;

  toggleBtn.addEventListener('click', () => {
    const isShowing = panel.classList.contains('show');
    if (isShowing) {
      panel.classList.remove('show');
      if (arrow) arrow.style.transform = 'rotate(0deg)';
    } else {
      panel.classList.add('show');
      if (arrow) arrow.style.transform = 'rotate(180deg)';
    }
  });

  closeBtn?.addEventListener('click', () => {
    panel.classList.remove('show');
    if (arrow) arrow.style.transform = 'rotate(0deg)';
  });
}

// ---------------- VIEW SWITCHER ----------------

function initViewSwitcher() {
  const btns = document.querySelectorAll('.view-btn');
  btns.forEach(btn => {
    btn.addEventListener('click', () => {
      btns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const mode = btn.dataset.view;
      setViewMode(mode);
    });
  });
}

function setViewMode(mode) {
  const viewport = document.getElementById('main-viewport');
  if (!viewport) return;

  viewport.className = `main-viewport mode-${mode}`;

  // Trigger leaflet resize
  setTimeout(() => {
    if (adminMap) adminMap.invalidateSize();
    if (mobileGpsMap) mobileGpsMap.invalidateSize();
    if (mobileFootprintMap) mobileFootprintMap.invalidateSize();
  }, 200);
}

// ---------------- STATS COUNTERS ----------------

function updateAdminStats() {
  const total = MOCK_DATA.buildings.length;
  const approved = MOCK_DATA.buildings.filter(b => b.status === 'approved').length;
  const pending = MOCK_DATA.buildings.filter(b => b.status === 'pending').length;
  const flagged = MOCK_DATA.buildings.filter(b => b.flagged).length;

  document.getElementById('stat-total-houses').innerText = total;
  document.getElementById('stat-approved-houses').innerText = approved;
  document.getElementById('stat-pending-houses').innerText = pending;
  document.getElementById('stat-flagged-houses').innerText = flagged;
}

// ---------------- APPROVAL DRAWER ----------------

window.openApprovalDrawer = function(buildingId) {
  const building = MOCK_DATA.buildings.find(b => b.id === buildingId);
  if (!building) return;

  currentActiveBuildingId = buildingId;
  const drawer = document.getElementById('approval-drawer');
  if (!drawer) return;

  // Populate Header
  document.getElementById('drawer-house-code').innerText = building.houseCode;
  document.getElementById('drawer-owner-name').innerText = building.ownerName;
  document.getElementById('drawer-address').innerText = building.address;
  document.getElementById('drawer-surveyor-name').innerText = building.surveyorName;
  document.getElementById('drawer-survey-date').innerText = building.surveyDate;

  // Status Badge
  const statusEl = document.getElementById('drawer-status-chip');
  statusEl.className = `status-chip ${building.status}`;
  statusEl.innerText = building.status === 'approved' ? 'Đã duyệt' : (building.flagged ? '⚠️ Cảnh báo sai lệch GPS' : 'Chờ duyệt');

  // GPS Comparison
  const gpsCard = document.getElementById('drawer-gps-card');
  const meter = document.getElementById('drawer-gps-meter');
  const meterVal = document.getElementById('drawer-gps-deviation-val');
  
  document.getElementById('drawer-gps-hardware').innerText = `${building.hardwareGps.lat.toFixed(6)}, ${building.hardwareGps.lng.toFixed(6)}`;
  document.getElementById('drawer-gps-pin').innerText = `${building.pinGps.lat.toFixed(6)}, ${building.pinGps.lng.toFixed(6)}`;
  meterVal.innerText = `${building.deviationMeters} mét`;

  if (building.flagged || building.deviationMeters > 50) {
    gpsCard.classList.add('flagged');
    meter.classList.add('flagged');
    document.getElementById('drawer-gps-warning-alert').style.display = 'block';
  } else {
    gpsCard.classList.remove('flagged');
    meter.classList.remove('flagged');
    document.getElementById('drawer-gps-warning-alert').style.display = 'none';
  }

  // Populate Structure Tree
  const treeContainer = document.getElementById('drawer-structure-tree');
  treeContainer.innerHTML = `
    <div class="tree-node">
      <div class="tree-node-title">
        <span>🏛️ Ngoại thất & Kết cấu</span>
        <span class="defect-pill">${building.structure.exterior.condition}</span>
      </div>
      <p style="font-size:11px;color:var(--text-muted);margin-top:4px;">${building.structure.exterior.notes}</p>
    </div>
  `;

  building.structure.floors.forEach(floor => {
    let roomsHtml = '';
    floor.rooms.forEach(room => {
      let compsHtml = '';
      room.components.forEach(comp => {
        compsHtml += `
          <div style="font-size:11.5px;color:#334155;padding:3px 0;display:flex;justify-content:space-between;">
            <span>• <b>${comp.name}</b>: ${comp.defects}</span>
          </div>
        `;
      });
      roomsHtml += `
        <div style="margin-top:6px;padding-left:8px;border-left:2px solid #0284c7;">
          <div style="font-size:12px;font-weight:700;color:#0284c7;">🚪 ${room.name}</div>
          ${compsHtml}
        </div>
      `;
    });

    const fNode = document.createElement('div');
    fNode.className = 'tree-node';
    fNode.innerHTML = `
      <div class="tree-node-title">
        <span>🏢 ${floor.name}</span>
        <span class="defect-pill">${floor.rooms.length} phòng</span>
      </div>
      ${roomsHtml}
    `;
    treeContainer.appendChild(fNode);
  });

  // Populate Photos
  const photoGrid = document.getElementById('drawer-photo-grid');
  photoGrid.innerHTML = '';
  building.photos.forEach(p => {
    const card = document.createElement('div');
    card.className = 'photo-card';
    card.innerHTML = `
      <img src="${p.url}" alt="${p.caption}"/>
      <div class="photo-watermark-preview">${p.watermark}</div>
    `;
    photoGrid.appendChild(card);
  });

  // Open Drawer
  drawer.classList.add('open');

  // Fly Admin Map to building
  if (adminMap) {
    adminMap.flyTo([building.pinGps.lat, building.pinGps.lng], 19, { duration: 0.8 });
  }
};

function closeApprovalDrawer() {
  document.getElementById('approval-drawer')?.classList.remove('open');
}

// ---------------- APPROVE / REJECT ACTIONS ----------------

function approveCurrentSurvey() {
  if (!currentActiveBuildingId) return;

  const building = MOCK_DATA.buildings.find(b => b.id === currentActiveBuildingId);
  if (!building) return;

  building.status = 'approved';
  building.flagged = false;

  // Re-render GIS Map (Reverse GIS sync polygon!)
  renderBuildingsOnAdminMap();
  updateAdminStats();

  showToast(`🎉 Đã PHÊ DUYỆT hồ sơ [${building.houseCode}]! Ranh giới footprint thực tế đã được đồng bộ vào bản đồ GIS trung tâm.`, 'success');
  closeApprovalDrawer();
}

function rejectCurrentSurvey() {
  if (!currentActiveBuildingId) return;

  const building = MOCK_DATA.buildings.find(b => b.id === currentActiveBuildingId);
  if (!building) return;

  const reason = prompt("Nhập lý do từ chối / yêu cầu khảo sát lại:", "Ảnh chụp chưa rõ vết nứt tại dầm phòng khách; Cần đo lại khoảng cách GPS.");
  if (!reason) return;

  building.status = 'rejected';
  renderBuildingsOnAdminMap();
  updateAdminStats();

  showToast(`❌ Đã trả về hồ sơ [${building.houseCode}] kèm yêu cầu khảo sát bổ sung.`, 'danger');
  closeApprovalDrawer();
}

// ---------------- TOAST UTILITY ----------------

function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  let icon = 'ℹ️';
  if (type === 'success') icon = '✅';
  else if (type === 'warning') icon = '⚠️';
  else if (type === 'danger') icon = '🚨';

  toast.innerHTML = `
    <span style="font-size:18px;">${icon}</span>
    <span style="flex:1;line-height:1.4;">${message}</span>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}
