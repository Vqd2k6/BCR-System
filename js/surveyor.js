/**
 * MOBILE FIELD SURVEYOR STEP-BY-STEP WORKFLOW CONTROLLER
 * TÍCH HỢP CƠ CHẾ BẢO VỆ DỮ LIỆU NGOẠI TUYẾN & TỰ ĐỘNG LƯU NHÁP (LOCAL DRAFT AUTO-SAVE)
 */

let currentStep = 1;
let crackCanvasManager = null;
const DRAFT_STORAGE_KEY = 'KSQH_SURVEY_DRAFT_V1';

// Initialize Surveyor Mobile Module
function initSurveyorWorkflow() {
  // 1. Tải dữ liệu nháp đã lưu từ bộ nhớ máy (nếu có)
  loadDraftFromStorage();

  renderDynamicTree();
  updateWizardUI();
  initNetworkListeners();

  // Auto-detect mobile screen and adjust view
  if (window.innerWidth <= 768) {
    if (window.setViewMode) window.setViewMode('mobile');
  }

  // Attach dynamic buttons & input auto-save listeners
  document.getElementById('btn-add-floor')?.addEventListener('click', addFloor);
  document.getElementById('btn-mobile-next')?.addEventListener('click', nextStep);
  document.getElementById('btn-mobile-prev')?.addEventListener('click', prevStep);
  document.getElementById('btn-mobile-submit')?.addEventListener('click', submitSurvey);

  // Auto-save on text typing
  ['input-house-code', 'input-owner-name', 'input-address'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', () => {
      saveDraftToStorage();
    });
  });
}

// ---------------- LOCAL DRAFT AUTO-SAVE (CHỐNG MẤT DỮ LIỆU KHI MẤT MẠNG/LAG) ----------------

function saveDraftToStorage() {
  try {
    currentSurveyData.houseCode = document.getElementById('input-house-code')?.value || currentSurveyData.houseCode;
    currentSurveyData.ownerName = document.getElementById('input-owner-name')?.value || currentSurveyData.ownerName;
    currentSurveyData.address = document.getElementById('input-address')?.value || currentSurveyData.address;
    currentSurveyData.savedAt = new Date().toISOString();

    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(currentSurveyData));
    updateDraftIndicator('💾 Đã lưu nháp tự động');
  } catch (e) {
    console.warn('Cannot save to localStorage:', e);
  }
}

function loadDraftFromStorage() {
  try {
    const saved = localStorage.getItem(DRAFT_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && parsed.houseCode) {
        currentSurveyData = { ...currentSurveyData, ...parsed };
        
        // Restore input values
        setTimeout(() => {
          const elCode = document.getElementById('input-house-code');
          const elOwner = document.getElementById('input-owner-name');
          const elAddr = document.getElementById('input-address');
          if (elCode) elCode.value = currentSurveyData.houseCode || '';
          if (elOwner) elOwner.value = currentSurveyData.ownerName || '';
          if (elAddr) elAddr.value = currentSurveyData.address || '';
        }, 50);

        console.log('✅ Đã khôi phục thành công bản nháp khảo sát từ bộ nhớ máy!');
      }
    }
  } catch (e) {
    console.warn('Cannot load draft:', e);
  }
}

function clearDraftStorage() {
  try {
    localStorage.removeItem(DRAFT_STORAGE_KEY);
  } catch (e) {}
}

function updateDraftIndicator(text) {
  const el = document.getElementById('mobile-draft-status');
  if (el) {
    el.innerText = text;
    el.style.opacity = '1';
    setTimeout(() => {
      if (el) el.style.opacity = '0.7';
    }, 2000);
  }
}

// ---------------- NETWORK LISTENER (ONLINE / OFFLINE DETECTION) ----------------

function initNetworkListeners() {
  window.addEventListener('online', () => {
    showToast('📶 Đã có kết nối Internet trở lại!', 'success');
    const badge = document.getElementById('mobile-network-badge');
    if (badge) {
      badge.innerText = 'Trực tuyến 5G';
      badge.className = 'surveyor-badge';
      badge.style.background = '#dcfce7';
      badge.style.color = '#15803d';
    }
  });

  window.addEventListener('offline', () => {
    showToast('⚠️ Mất mạng Internet! Hệ thống chuyển sang lưu trữ Offline trên máy.', 'warning');
    const badge = document.getElementById('mobile-network-badge');
    if (badge) {
      badge.innerText = 'Ngoại tuyến (Offline)';
      badge.className = 'surveyor-badge';
      badge.style.background = '#fee2e2';
      badge.style.color = '#dc2626';
    }
  });
}

// Function to fetch real device GPS via HTML5 Geolocation API
window.useRealDeviceLocation = function() {
  if (!navigator.geolocation) {
    showToast('Trình duyệt không hỗ trợ Geolocation', 'warning');
    return;
  }

  showToast('Đang bắt tọa độ GPS từ chip thiết bị...', 'info');

  navigator.geolocation.getCurrentPosition(
    (position) => {
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      const accuracy = position.coords.accuracy;

      currentSurveyData.hardwareGps = { lat, lng };
      currentSurveyData.pinGps = { lat, lng };
      currentSurveyData.deviationMeters = 0.0;

      if (mobileGpsMap) {
        mobileGpsMap.setView([lat, lng], 19);
      }

      showToast(`🎯 Đã bắt GPS thực tế thành công! Độ chính xác: ±${accuracy.toFixed(1)}m`, 'success');
      
      const meterEl = document.getElementById('mobile-gps-deviation-meter');
      if (meterEl) meterEl.innerText = '0.0m';
      
      saveDraftToStorage();
      updateCameraWatermarkPreview();
    },
    (error) => {
      showToast('Không thể lấy GPS thực tế (vui lòng cấp quyền truy cập vị trí)', 'warning');
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
  );
};

// Navigation Steps
function goToStep(step) {
  currentStep = step;
  
  // Hide all step sections
  document.querySelectorAll('.mobile-step-section').forEach(sec => sec.style.display = 'none');
  
  const activeSec = document.getElementById(`mobile-step-${step}`);
  if (activeSec) activeSec.style.display = 'flex';

  updateWizardUI();
  saveDraftToStorage();

  // Step specific initialization
  if (step === 1) {
    setTimeout(() => {
      if (mobileGpsMap) mobileGpsMap.invalidateSize();
      else initMobileGpsMap();
    }, 100);
  } else if (step === 3) {
    // Camera step
    updateCameraWatermarkPreview();
  } else if (step === 4) {
    // Crack Canvas step
    setTimeout(() => {
      if (!crackCanvasManager) {
        crackCanvasManager = new CrackCanvasManager('crack-draw-canvas');
      } else {
        crackCanvasManager.redraw();
      }
    }, 100);
  } else if (step === 5) {
    // Footprint Map step
    setTimeout(() => {
      if (mobileFootprintMap) mobileFootprintMap.invalidateSize();
      else initMobileFootprintMap();
    }, 100);
  }
}

function nextStep() {
  if (currentStep < 6) {
    // Read input values at step 1
    if (currentStep === 1) {
      currentSurveyData.houseCode = document.getElementById('input-house-code')?.value || 'TB-BH-003';
      currentSurveyData.ownerName = document.getElementById('input-owner-name')?.value || 'Hoàng Minh Tâm';
      currentSurveyData.address = document.getElementById('input-address')?.value || '156 Trường Chinh, P.12, Q. Tân Bình';
    }
    saveDraftToStorage();
    goToStep(currentStep + 1);
  }
}

function prevStep() {
  if (currentStep > 1) {
    goToStep(currentStep - 1);
  }
}

function updateWizardUI() {
  for (let i = 1; i <= 6; i++) {
    const item = document.getElementById(`wiz-step-${i}`);
    if (!item) continue;
    item.classList.remove('active', 'completed');
    if (i === currentStep) item.classList.add('active');
    else if (i < currentStep) item.classList.add('completed');
  }

  // Update bottom buttons
  const prevBtn = document.getElementById('btn-mobile-prev');
  const nextBtn = document.getElementById('btn-mobile-next');
  const submitBtn = document.getElementById('btn-mobile-submit');

  if (prevBtn) prevBtn.style.display = currentStep === 1 ? 'none' : 'inline-flex';
  if (nextBtn) nextBtn.style.display = currentStep === 6 ? 'none' : 'inline-flex';
  if (submitBtn) submitBtn.style.display = currentStep === 6 ? 'inline-flex' : 'none';
}

// ---------------- DYNAMIC STRUCTURAL TREE BUILDER ----------------

function renderDynamicTree() {
  const container = document.getElementById('dynamic-tree-container');
  if (!container) return;

  container.innerHTML = '';

  // Exterior card
  const extCard = document.createElement('div');
  extCard.className = 'dynamic-floor-card';
  extCard.innerHTML = `
    <div class="floor-header">
      <span class="floor-title">🏛️ Ngoại thất & Kết cấu chung</span>
      <span class="status-chip approved">Đã kiểm tra</span>
    </div>
    <p style="font-size:11px;color:var(--text-muted);">${currentSurveyData.structure.exterior.notes}</p>
  `;
  container.appendChild(extCard);

  // Dynamic Floors
  currentSurveyData.structure.floors.forEach((floor, fIdx) => {
    const fCard = document.createElement('div');
    fCard.className = 'dynamic-floor-card';

    let roomsHtml = '';
    floor.rooms.forEach((room, rIdx) => {
      let compsHtml = '';
      room.components.forEach((comp, cIdx) => {
        compsHtml += `
          <div class="comp-tag ${comp.hasCrack ? 'has-crack' : ''}" onclick="openCrackEditor(${fIdx}, ${rIdx}, ${cIdx})">
            <span>${comp.hasCrack ? '⚠️ ' : '🧱 '}${comp.name}</span>
            ${comp.hasCrack ? `<span style="font-size:9px;color:#dc2626;font-weight:700;">(Nứt)</span>` : ''}
          </div>
        `;
      });

      roomsHtml += `
        <div class="room-item">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <strong style="font-size:12px;color:var(--primary);">🚪 ${room.name}</strong>
            <button class="btn btn-secondary btn-sm" style="padding:2px 6px;font-size:9.5px;" onclick="addComponent(${fIdx}, ${rIdx})">+ Cấu kiện</button>
          </div>
          <div class="component-tag-list">${compsHtml}</div>
        </div>
      `;
    });

    fCard.innerHTML = `
      <div class="floor-header">
        <span class="floor-title">🏢 ${floor.name}</span>
        <button class="btn btn-secondary btn-sm" style="padding:3px 8px;font-size:10px;" onclick="addRoom(${fIdx})">+ Thêm Phòng</button>
      </div>
      <div style="display:flex;flex-direction:column;gap:6px;">${roomsHtml}</div>
    `;
    container.appendChild(fCard);
  });
}

function addFloor() {
  const floorNum = currentSurveyData.structure.floors.length + 1;
  const floorName = floorNum === 1 ? "Tầng Trệt" : `Lầu ${floorNum - 1}`;
  
  currentSurveyData.structure.floors.push({
    name: floorName,
    rooms: [
      {
        name: "Phòng Chính",
        components: [
          { name: "Tường", defects: "Bình thường", hasCrack: false },
          { name: "Trần", defects: "Bình thường", hasCrack: false }
        ]
      }
    ]
  });
  renderDynamicTree();
  saveDraftToStorage();
  showToast(`Đã thêm ${floorName} vào cấu trúc nhà`, 'info');
}

function addRoom(fIdx) {
  const rName = prompt("Nhập tên phòng cần thêm (vd: Bếp, Phòng ngủ 2, Ban công, WC):", "Phòng Ngủ Mới");
  if (!rName) return;

  currentSurveyData.structure.floors[fIdx].rooms.push({
    name: rName,
    components: [
      { name: "Tường", defects: "Bình thường", hasCrack: false },
      { name: "Sàn", defects: "Bình thường", hasCrack: false }
    ]
  });
  renderDynamicTree();
  saveDraftToStorage();
}

function addComponent(fIdx, rIdx) {
  const cName = prompt("Nhập cấu kiện cần khảo sát (vd: Cột chịu lực, Dầm trần, Khung cửa sổ, Tường nứt):", "Dầm Cột");
  if (!cName) return;

  currentSurveyData.structure.floors[fIdx].rooms[rIdx].components.push({
    name: cName,
    defects: "Bình thường",
    hasCrack: false
  });
  renderDynamicTree();
  saveDraftToStorage();
}

function openCrackEditor(fIdx, rIdx, cIdx) {
  const comp = currentSurveyData.structure.floors[fIdx].rooms[rIdx].components[cIdx];
  const choice = confirm(`Khảo sát cấu kiện: [${comp.name}]\nBạn có muốn chuyển sang màn hình Chụp ảnh & Vẽ đánh dấu vết nứt cho cấu kiện này không?`);
  if (choice) {
    comp.hasCrack = true;
    renderDynamicTree();
    saveDraftToStorage();
    goToStep(4);
  }
}

// ---------------- CAMERA & WATERMARK ----------------

function updateCameraWatermarkPreview() {
  const el = document.getElementById('camera-watermark-text');
  if (!el) return;
  const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
  const lat = currentSurveyData.hardwareGps?.lat.toFixed(6) || '10.797120';
  const lng = currentSurveyData.hardwareGps?.lng.toFixed(6) || '106.653850';
  el.innerHTML = `
    📍 GPS: ${lat}, ${lng} (±2m)<br/>
    🕒 ${now} | MÃ CĂN: ${currentSurveyData.houseCode} | VỊ TRÍ: NGOẠI THẤT
  `;
}

function capturePhotoSimulation() {
  showToast("📸 Đã chụp ảnh và tự động dập Watermark GPS ngầm!", "success");
  
  // Create sample photo with watermark
  const samplePhoto = {
    url: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='600' height='400' style='background:%231e293b;'><rect width='100%25' height='100%25' fill='%230f172a'/><path d='M 120 150 Q 280 250 480 320' stroke='%23ef4444' stroke-width='4' fill='none'/><text x='50%25' y='35%25' fill='%2338bdf8' font-size='18' font-family='sans-serif' text-anchor='middle'>ẢNH KHẢO SÁT THỰC ĐỊA</text><text x='50%25' y='50%25' fill='%23ef4444' font-size='15' font-family='sans-serif' text-anchor='middle'>ĐÃ GHI NHẬN VẾT NỨT MỚI</text></svg>",
    caption: "Hiện trạng nứt tường tầng trệt",
    watermark: `GPS: ${currentSurveyData.hardwareGps.lat.toFixed(6)}, ${currentSurveyData.hardwareGps.lng.toFixed(6)} | ${new Date().toLocaleString('vi-VN')} | ${currentSurveyData.houseCode}`
  };
  
  currentSurveyData.photos.push(samplePhoto);
  saveDraftToStorage();
  goToStep(4); // Move to crack measurement
}

// ---------------- SUBMIT SURVEY ----------------

function submitSurvey() {
  // Ensure footprint exists
  if (!currentSurveyData.footprint || currentSurveyData.footprint.length < 3) {
    if (window.loadSampleFootprint) window.loadSampleFootprint();
  }

  // Export current crack canvas if any
  if (crackCanvasManager && crackCanvasManager.annotations.length > 0) {
    const exportedUrl = crackCanvasManager.exportImage();
    currentSurveyData.photos.push({
      url: exportedUrl,
      caption: "Bản vẽ đo đạc vết nứt thực địa",
      watermark: `GPS: ${currentSurveyData.hardwareGps.lat.toFixed(6)}, ${currentSurveyData.hardwareGps.lng.toFixed(6)} | ${currentSurveyData.houseCode}`
    });
  }

  // Create new record in MOCK_DATA
  const newRecord = {
    id: currentSurveyData.houseCode,
    houseCode: currentSurveyData.houseCode,
    ownerName: currentSurveyData.ownerName,
    address: currentSurveyData.address,
    zoneId: currentSurveyData.zoneId,
    status: "pending",
    flagged: currentSurveyData.deviationMeters > 50,
    hardwareGps: { ...currentSurveyData.hardwareGps },
    pinGps: { ...currentSurveyData.pinGps },
    deviationMeters: currentSurveyData.deviationMeters,
    footprint: [...currentSurveyData.footprint],
    surveyDate: new Date().toLocaleString('vi-VN'),
    surveyorName: "Nguyễn Văn Hùng (Mã: NV-08)",
    structure: JSON.parse(JSON.stringify(currentSurveyData.structure)),
    photos: currentSurveyData.photos.length > 0 ? [...currentSurveyData.photos] : [
      {
        url: crackCanvasManager ? crackCanvasManager.exportImage() : "",
        caption: "Ảnh hiện trạng dập Watermark",
        watermark: `GPS: ${currentSurveyData.hardwareGps.lat.toFixed(6)}, ${currentSurveyData.hardwareGps.lng.toFixed(6)}`
      }
    ]
  };

  // Add to buildings list
  MOCK_DATA.buildings.unshift(newRecord);

  // Re-render map and update stats
  renderBuildingsOnAdminMap();
  updateAdminStats();

  // Clear draft after successful submission
  clearDraftStorage();

  showToast(`✅ Đã nộp hồ sơ công trình [${newRecord.houseCode}] thành công! Hồ sơ đã được đồng bộ sang Web Admin để kiểm duyệt.`, 'success');

  // Switch to review drawer on Web Admin automatically if in split mode
  if (window.openApprovalDrawer) {
    window.openApprovalDrawer(newRecord.id);
  }

  // Reset to step 1 for next house
  setTimeout(() => {
    currentSurveyData.houseCode = "TB-BH-004";
    currentSurveyData.ownerName = "Nguyễn Thị Hương";
    currentSurveyData.address = "162 Trường Chinh, P.12, Q. Tân Bình";
    currentSurveyData.hardwareGps.lat += 0.00015;
    currentSurveyData.pinGps.lat += 0.00015;
    currentSurveyData.photos = [];
    currentSurveyData.structure = {
      exterior: { condition: "Bình thường", notes: "Nhà 1 trệt 2 lầu đúc bê tông cốt thép" },
      floors: [
        {
          name: "Tầng Trệt",
          rooms: [{ name: "Phòng Khách", components: [{ name: "Tường trước", defects: "Bình thường", hasCrack: false }] }]
        }
      ]
    };
    goToStep(1);
  }, 1500);
}
