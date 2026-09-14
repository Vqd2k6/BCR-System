/**
 * CRACK ANNOTATION CANVAS & WATERMARK GENERATOR
 */

class CrackCanvasManager {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');
    this.isDrawing = false;
    this.points = [];
    this.bgImage = null;
    this.annotations = [];
    
    this.initEvents();
    this.loadDefaultScene();
  }

  initEvents() {
    this.canvas.addEventListener('mousedown', (e) => this.startDraw(e));
    this.canvas.addEventListener('mousemove', (e) => this.draw(e));
    this.canvas.addEventListener('mouseup', () => this.endDraw());
    this.canvas.addEventListener('mouseleave', () => this.endDraw());

    // Touch support for mobile
    this.canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const touch = e.touches[0];
      const mouseEvent = new MouseEvent('mousedown', {
        clientX: touch.clientX,
        clientY: touch.clientY
      });
      this.canvas.dispatchEvent(mouseEvent);
    });

    this.canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      const touch = e.touches[0];
      const mouseEvent = new MouseEvent('mousemove', {
        clientX: touch.clientX,
        clientY: touch.clientY
      });
      this.canvas.dispatchEvent(mouseEvent);
    });

    this.canvas.addEventListener('touchend', (e) => {
      e.preventDefault();
      const mouseEvent = new MouseEvent('mouseup', {});
      this.canvas.dispatchEvent(mouseEvent);
    });
  }

  loadDefaultScene(sampleType = 'wall') {
    const width = this.canvas.width = this.canvas.parentElement.clientWidth || 340;
    const height = this.canvas.height = 220;

    // Create realistic simulated wall background
    const bgCanvas = document.createElement('canvas');
    bgCanvas.width = width;
    bgCanvas.height = height;
    const bgCtx = bgCanvas.getContext('2d');

    // Concrete wall gradient
    const grad = bgCtx.createLinearGradient(0, 0, width, height);
    grad.addColorStop(0, '#334155');
    grad.addColorStop(0.5, '#1e293b');
    grad.addColorStop(1, '#0f172a');
    bgCtx.fillStyle = grad;
    bgCtx.fillRect(0, 0, width, height);

    // Wall texture noise / grid lines
    bgCtx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    bgCtx.lineWidth = 1;
    for (let x = 0; x < width; x += 40) {
      bgCtx.beginPath();
      bgCtx.moveTo(x, 0);
      bgCtx.lineTo(x, height);
      bgCtx.stroke();
    }

    // Pillar / Corner edge simulation
    bgCtx.fillStyle = 'rgba(0, 0, 0, 0.25)';
    bgCtx.fillRect(0, 0, 60, height);
    bgCtx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    bgCtx.beginPath();
    bgCtx.moveTo(60, 0);
    bgCtx.lineTo(60, height);
    bgCtx.stroke();

    this.bgImage = bgCanvas;
    this.redraw();
  }

  getPos(e) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (this.canvas.width / rect.width),
      y: (e.clientY - rect.top) * (this.canvas.height / rect.height)
    };
  }

  startDraw(e) {
    this.isDrawing = true;
    const pos = this.getPos(e);
    this.points = [pos];
  }

  draw(e) {
    if (!this.isDrawing) return;
    const pos = this.getPos(e);
    this.points.push(pos);
    this.redraw();

    // Draw active crack line
    this.ctx.beginPath();
    this.ctx.strokeStyle = '#ef4444';
    this.ctx.lineWidth = 3;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
    for (let i = 0; i < this.points.length; i++) {
      if (i === 0) this.ctx.moveTo(this.points[i].x, this.points[i].y);
      else this.ctx.lineTo(this.points[i].x, this.points[i].y);
    }
    this.ctx.stroke();
  }

  endDraw() {
    if (!this.isDrawing) return;
    this.isDrawing = false;
    if (this.points.length > 2) {
      this.annotations.push({
        points: [...this.points],
        lengthCm: document.getElementById('crack-length')?.value || 35,
        widthMm: document.getElementById('crack-width')?.value || 0.8
      });
    }
    this.redraw();
  }

  clear() {
    this.annotations = [];
    this.points = [];
    this.redraw();
  }

  redraw() {
    if (!this.bgImage) return;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.drawImage(this.bgImage, 0, 0);

    // Draw saved annotations
    this.annotations.forEach((ann, idx) => {
      this.ctx.beginPath();
      this.ctx.strokeStyle = '#ef4444';
      this.ctx.lineWidth = 3.5;
      this.ctx.lineCap = 'round';
      this.ctx.lineJoin = 'round';
      ann.points.forEach((pt, i) => {
        if (i === 0) this.ctx.moveTo(pt.x, pt.y);
        else this.ctx.lineTo(pt.x, pt.y);
      });
      this.ctx.stroke();

      // Draw measurement label tag
      const midPoint = ann.points[Math.floor(ann.points.length / 2)];
      if (midPoint) {
        const text = `Nứt #${idx + 1}: L=${ann.lengthCm}cm | W=${ann.widthMm}mm`;
        this.ctx.font = 'bold 10px JetBrains Mono, monospace';
        const textWidth = this.ctx.measureText(text).width;
        
        this.ctx.fillStyle = 'rgba(239, 68, 68, 0.9)';
        this.ctx.fillRect(midPoint.x - 4, midPoint.y - 18, textWidth + 8, 16);
        this.ctx.fillStyle = '#ffffff';
        this.ctx.fillText(text, midPoint.x, midPoint.y - 6);
      }
    });

    // Draw Watermark at the bottom
    this.drawWatermark();
  }

  drawWatermark() {
    const w = this.canvas.width;
    const h = this.canvas.height;
    const barHeight = 28;

    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
    this.ctx.fillRect(0, h - barHeight, w, barHeight);

    this.ctx.fillStyle = '#38bdf8';
    this.ctx.font = 'bold 9px JetBrains Mono, monospace';
    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const house = currentSurveyData.houseCode || 'TB-BH-003';
    const lat = currentSurveyData.hardwareGps?.lat.toFixed(6) || '10.797120';
    const lng = currentSurveyData.hardwareGps?.lng.toFixed(6) || '106.653850';

    this.ctx.fillText(`📍 GPS: ${lat}, ${lng} [Chính xác: ±2.5m]`, 8, h - 16);
    this.ctx.fillStyle = '#f8fafc';
    this.ctx.fillText(`🕒 ${now} | Căn: ${house} | TẦNG TRỆT`, 8, h - 5);
  }

  exportImage() {
    return this.canvas.toDataURL('image/jpeg', 0.95);
  }
}
