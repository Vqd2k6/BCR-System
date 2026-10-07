const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const artifactDir = '/Users/vqd2k6/.gemini/antigravity-ide/brain/e9fcce39-3111-4607-9a38-b82066dbf9d1';

(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 1600, deviceScaleFactor: 1 });

  // 1. Snapshot C&C-05-B-0058 (0 khuyết tật nhưng ĐẦY ĐỦ ẢNH TẤT CẢ CÁC PHÒNG)
  const p0058Path = 'file://' + path.resolve(__dirname, '../../sample_export/batch_test/preview_C&C-05-B-0058.html');
  await page.goto(p0058Path, { waitUntil: 'networkidle0' });
  let pages = await page.$$('.a4-page-sheet');
  console.log('0058 total pages in DOM:', pages.length);
  // Page 1: Cover (1 of 18)
  await pages[0].screenshot({ path: path.join(artifactDir, '0058_cover_page_1of18.png') });
  // Page 2: TOC
  await pages[1].screenshot({ path: path.join(artifactDir, '0058_toc_18pages.png') });
  // Page 12: Tầng trệt - Hồ sơ ảnh tổng thể các phòng (Sheet 1/1)
  await pages[11].screenshot({ path: path.join(artifactDir, '0058_room_overview_ground_floor.png') });

  // 2. Snapshot C&C-05-B-0158 (Khuyết tật có 3 ảnh đối chiếu: bối cảnh + cận cảnh 1 + cận cảnh thước đo nứt)
  const p0158Path = 'file://' + path.resolve(__dirname, '../../sample_export/batch_test/preview_C&C-05-B-0158.html');
  await page.goto(p0158Path, { waitUntil: 'networkidle0' });
  pages = await page.$$('.a4-page-sheet');
  console.log('0158 total pages in DOM:', pages.length);
  // Find page with room-overview-grid
  for (let i = 0; i < pages.length; i++) {
    const hasRoomGrid = await pages[i].$('.room-overview-grid');
    if (hasRoomGrid) {
      console.log('0158 room overview found on page', i + 1);
      await pages[i].screenshot({ path: path.join(artifactDir, '0158_room_overview_grid.png') });
      break;
    }
  }
  // Find page with defect-trio-container
  for (let i = 0; i < pages.length; i++) {
    const hasTrio = await pages[i].$('.defect-trio-container');
    if (hasTrio) {
      console.log('0158 defect trio found on page', i + 1);
      await pages[i].screenshot({ path: path.join(artifactDir, '0158_defect_trio_gauge_photos.png') });
      break;
    }
  }

  // 3. Snapshot C&C-05-B-0056 (3 tầng, 0 khuyết tật - 28 ảnh phòng)
  const p0056Path = 'file://' + path.resolve(__dirname, '../../sample_export/batch_test/preview_C&C-05-B-0056.html');
  await page.goto(p0056Path, { waitUntil: 'networkidle0' });
  pages = await page.$$('.a4-page-sheet');
  console.log('0056 total pages in DOM:', pages.length);
  for (let i = 0; i < pages.length; i++) {
    const hasRoomGrid = await pages[i].$('.room-overview-grid');
    if (hasRoomGrid) {
      console.log('0056 room overview found on page', i + 1);
      await pages[i].screenshot({ path: path.join(artifactDir, '0056_room_overview_grid.png') });
      break;
    }
  }

  await browser.close();
  console.log('All visual verification screenshots captured!');
})();
