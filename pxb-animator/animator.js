/**
 * PixelBanner (.pxb) Animator - Core Playback & File I/O Controller
 * @file animator.js
 * @author BjornEriksson (https://github.com)
 * @version 0.1.0-beta
 */
class PixelBannerAnimator {
  constructor() {
    this.appWindow = document.querySelector('.app-window');
    this.canvas = document.getElementById('preview-canvas');
    this.ctx = this.canvas.getContext('2d');

    const LIMITS = (typeof StudioConfig !== 'undefined')
      ? StudioConfig.LIMITS
      : { MIN_WIN_W: 540, MAX_WIN_W: 1920, MIN_WIN_H: 400, MAX_WIN_H: 1200 };

    const boot = (typeof StudioConfig !== 'undefined')
      ? StudioConfig.getBootConfig()
      : {};

    const clamp = (val, min, max, fallback) => {
      const n = Number(val);
      return Number.isFinite(n) ? Math.max(min, Math.min(max, Math.round(n))) : fallback;
    };

    if (this.appWindow) {
      const reqW = document.body?.dataset?.winW ?? boot.windowWidth;
      const reqH = document.body?.dataset?.winH ?? (boot.windowHeight ? boot.windowHeight + 120 : 680);
      const initWinW = clamp(reqW, LIMITS.MIN_WIN_W, LIMITS.MAX_WIN_W, 840);
      const initWinH = clamp(reqH, LIMITS.MIN_WIN_H, LIMITS.MAX_WIN_H, 680);
      this.appWindow.style.width = `${initWinW}px`;
      this.appWindow.style.height = `${initWinH}px`;
    }
	  
    this.canvas = document.getElementById('preview-canvas');
    this.ctx = this.canvas.getContext('2d');

    this.gridWidth = 0;
    this.gridHeight = 0;
    this.pixelScale = 5;
    this.rasterStyle = 1;
    this.rasterThickness = 1;
    this.rasterColor24 = ColorEngine.DEFAULT_RASTER_24;
    this.paletteMode = ColorEngine.MODE_9BIT;
    this.loop = true;

    this.frames = [];
    this.selectedIndex = -1;
    this.isPlaying = false;
    this.playTimer = null;

    setupAnimatorHandlers(this);
    this.updateUIState();
  }

  clampDelay(val) {
    const n = Math.round(Number(val));
    return Number.isFinite(n) ? Math.max(10, Math.min(65535, n)) : 120;
  }

  setStatus(msg) {
    document.getElementById('status-msg').textContent = msg;
  }

  // =========================================================================
  // SECTION 1: FOLDER & FILE IMPORT / EXPORT (.pxi & .pxb)
  // =========================================================================
  async importPxiFiles(fileList, replaceExisting) {
    this.stopPlayback();

    const pxiFiles = fileList
      .filter((f) => f.name.toLowerCase().endsWith('.pxi'))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));

    if (pxiFiles.length === 0) {
      this.setStatus('No .pxi files found in selection');
      return;
    }

    const defaultDelay = this.clampDelay(document.getElementById('global-delay-input').value);
    const loaded = [];
    let skippedMismatch = 0;

    let targetW = replaceExisting ? 0 : this.gridWidth;
    let targetH = replaceExisting ? 0 : this.gridHeight;
    let targetMode = replaceExisting ? -1 : this.paletteMode;

    for (const file of pxiFiles) {
      try {
        const data = PxiCodec.decode(await file.arrayBuffer());
        if (targetW === 0) {
          targetW = data.gridWidth;
          targetH = data.gridHeight;
          targetMode = data.paletteMode;
          this.gridWidth = data.gridWidth;
          this.gridHeight = data.gridHeight;
          this.pixelScale = data.pixelScale;
          this.rasterStyle = data.rasterStyle;
          this.rasterThickness = data.rasterThickness;
          this.rasterColor24 = data.rasterColor24;
          this.paletteMode = data.paletteMode;
          if (data.signature && !document.getElementById('creator-signature').value) {
            document.getElementById('creator-signature').value = data.signature;
          }
        } else if (data.gridWidth !== targetW || data.gridHeight !== targetH || data.paletteMode !== targetMode) {
          skippedMismatch++;
          continue;
        }

        loaded.push({
          name: file.name,
          pixels: data.pixels,
          delayMs: defaultDelay,
          enabled: true
        });
      } catch {
        skippedMismatch++;
      }
    }

    if (loaded.length === 0) {
      this.setStatus('No matching .pxi frames could be loaded');
      return;
    }

    if (replaceExisting) {
      this.frames = loaded.slice(0, 255);
    } else {
      const spaceLeft = Math.max(0, 255 - this.frames.length);
      this.frames.push(...loaded.slice(0, spaceLeft));
    }

    this.selectedIndex = 0;
    TimelineUI.rebuild(this);
    this.renderCurrentFrame();
    this.updateUIState();

    const relPath = pxiFiles.webkitRelativePath;
    const folderHint = relPath ? `Folder "${relPath.split('/')}"` : 'Selection';
    const warn = skippedMismatch > 0 ? ` (${skippedMismatch} skipped: size/mode mismatch)` : '';
    this.setStatus(`${folderHint}: loaded ${loaded.length} frames${warn}`);
  }

  async openPxbFile(file) {
    this.stopPlayback();
    try {
      const data = PxbCodec.decode(await file.arrayBuffer());
      this.gridWidth = data.gridWidth;
      this.gridHeight = data.gridHeight;
      this.pixelScale = data.pixelScale;
      this.rasterStyle = data.rasterStyle;
      this.rasterThickness = data.rasterThickness;
      this.rasterColor24 = data.rasterColor24;
      this.paletteMode = data.paletteMode;
      this.loop = data.loop;
      document.getElementById('chk-loop').checked = data.loop;
      document.getElementById('creator-signature').value = data.signature || '';

      this.frames = data.frames.map((f, idx) => ({
        name: `frame_${String(idx + 1).padStart(2, '0')}.pxi`,
        pixels: f.pixels,
        delayMs: f.delayMs,
        enabled: true
      }));

      this.selectedIndex = 0;
      TimelineUI.rebuild(this);
      this.renderCurrentFrame();
      this.updateUIState();
      this.setStatus(`Loaded ${file.name} (${this.frames.length} frames)`);
    } catch {
      this.setStatus('Invalid .pxb animation file');
    }
  }

  savePxbFile() {
    const activeFrames = this.frames.filter((f) => f.enabled);
    if (activeFrames.length === 0) {
      this.setStatus('Enable at least 1 frame before saving');
      return;
    }

    const buf = PxbCodec.encode({
      gridWidth: this.gridWidth,
      gridHeight: this.gridHeight,
      pixelScale: this.pixelScale,
      rasterStyle: this.rasterStyle,
      rasterColor24: this.rasterColor24,
      paletteMode: this.paletteMode,
      rasterThickness: this.rasterThickness,
      loop: this.loop,
      frames: activeFrames,
      signature: document.getElementById('creator-signature').value
    });

    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([buf], { type: 'application/octet-stream' }));
    a.download = `banner_${this.gridWidth}x${this.gridHeight}_${activeFrames.length}f.pxb`;
    a.click();
    this.setStatus(`Exported .pxb (${buf.byteLength} B, ${activeFrames.length} frames)`);
  }

  // =========================================================================
  // SECTION 2: CANVAS RENDERING & FRAME OPERATIONS
  // =========================================================================
  getStepMetrics() {
    const t = (this.rasterStyle !== 0) ? this.rasterThickness : 0;
    const gapX = (this.rasterStyle === 1 || this.rasterStyle === 3) ? t : 0;
    const gapY = (this.rasterStyle === 1 || this.rasterStyle === 2) ? t : 0;
    return { stepX: this.pixelScale + gapX, stepY: this.pixelScale + gapY, gapX, gapY };
  }

  renderPixelsToCanvas(targetCanvas, pixels) {
    if (this.gridWidth === 0 || this.gridHeight === 0) return;
    const { stepX, stepY, gapX, gapY } = this.getStepMetrics();
    targetCanvas.width = Math.max(1, this.gridWidth * stepX - gapX);
    targetCanvas.height = Math.max(1, this.gridHeight * stepY - gapY);

    const ctx = targetCanvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    if (this.rasterStyle !== 0 && this.rasterThickness > 0) {
      ctx.fillStyle = ColorEngine.toCss(this.rasterColor24);
      ctx.fillRect(0, 0, targetCanvas.width, targetCanvas.height);
    } else {
      ctx.clearRect(0, 0, targetCanvas.width, targetCanvas.height);
    }

    const s = this.pixelScale;
    for (let y = 0; y < this.gridHeight; y++) {
      for (let x = 0; x < this.gridWidth; x++) {
        ctx.fillStyle = ColorEngine.toCss(pixels[y * this.gridWidth + x]);
        ctx.fillRect(x * stepX, y * stepY, s, s);
      }
    }
  }

  renderCurrentFrame() {
    if (this.selectedIndex < 0 || this.selectedIndex >= this.frames.length) return;
    this.renderPixelsToCanvas(this.canvas, this.frames[this.selectedIndex].pixels);
    document.getElementById('status-frame').textContent = `Frame: ${this.selectedIndex + 1} / ${this.frames.length}`;
  }

  selectFrame(idx) {
    if (idx < 0 || idx >= this.frames.length) return;
    this.selectedIndex = idx;
    this.renderCurrentFrame();

    const cards = document.querySelectorAll('#timeline-track .frame-card');
    cards.forEach((c, i) => {
      c.classList.toggle('selected', i === idx);
      if (i === idx) c.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    });
  }

  moveFrame(idx, dir) {
    const target = idx + dir;
    if (target < 0 || target >= this.frames.length) return;
    this.stopPlayback();
    const tmp = this.frames[idx];
    this.frames[idx] = this.frames[target];
    this.frames[target] = tmp;
    this.selectedIndex = target;
    TimelineUI.rebuild(this);
    this.renderCurrentFrame();
  }

  duplicateFrame(idx) {
    if (this.frames.length >= 255) return;
    this.stopPlayback();
    const src = this.frames[idx];
    this.frames.splice(idx + 1, 0, {
      name: src.name,
      pixels: new Uint32Array(src.pixels),
      delayMs: src.delayMs,
      enabled: src.enabled
    });
    this.selectedIndex = idx + 1;
    TimelineUI.rebuild(this);
    this.renderCurrentFrame();
    this.updateUIState();
  }

  removeFrame(idx) {
    this.stopPlayback();
    this.frames.splice(idx, 1);
    if (this.frames.length === 0) {
      this.selectedIndex = -1;
      this.gridWidth = 0;
      this.gridHeight = 0;
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    } else {
      this.selectedIndex = Math.min(idx, this.frames.length - 1);
      this.renderCurrentFrame();
    }
    TimelineUI.rebuild(this);
    this.updateUIState();
  }

  // =========================================================================
  // SECTION 3: PLAYBACK & UI STATE
  // =========================================================================
  togglePlayback() {
    if (this.isPlaying) {
      this.stopPlayback();
    } else {
      this.startPlayback();
    }
  }

  startPlayback() {
    if (this.frames.filter((f) => f.enabled).length === 0) {
      this.setStatus('No enabled frames to play');
      return;
    }

    this.isPlaying = true;
    const playBtn = document.getElementById('btn-play');
    playBtn.textContent = '⏸ Pause';
    playBtn.classList.add('playing');

    if (!this.frames[this.selectedIndex]?.enabled) {
      const firstActive = this.frames.findIndex((f) => f.enabled);
      if (firstActive !== -1) this.selectFrame(firstActive);
    }

    this.scheduleNextTick();
  }

  scheduleNextTick() {
    if (!this.isPlaying) return;
    const delay = this.frames[this.selectedIndex]?.delayMs || 120;

    this.playTimer = setTimeout(() => {
      if (!this.isPlaying) return;
      const nextIdx = this.findNextEnabledIndex(this.selectedIndex, 1);
      if (nextIdx === -1 || (!this.loop && nextIdx <= this.selectedIndex)) {
        this.stopPlayback();
        return;
      }
      this.selectFrame(nextIdx);
      this.scheduleNextTick();
    }, delay);
  }

  stopPlayback() {
    this.isPlaying = false;
    clearTimeout(this.playTimer);
    this.playTimer = null;
    const playBtn = document.getElementById('btn-play');
    if (playBtn) {
      playBtn.textContent = '▶ Play';
      playBtn.classList.remove('playing');
    }
  }

  findNextEnabledIndex(fromIdx, step) {
    const len = this.frames.length;
    for (let i = 1; i <= len; i++) {
      const candidate = (fromIdx + step * i + len) % len;
      if (this.frames[candidate].enabled) return candidate;
    }
    return -1;
  }

  stepFrame(dir) {
    this.stopPlayback();
    if (this.frames.length === 0) return;
    const nextIdx = (this.selectedIndex + dir + this.frames.length) % this.frames.length;
    this.selectFrame(nextIdx);
  }

  updateUIState() {
    const hasFrames = this.frames.length > 0;
    const activeFrames = this.frames.filter((f) => f.enabled);
    const totalMs = activeFrames.reduce((sum, f) => sum + f.delayMs, 0);

    document.getElementById('menu-save-pxb').disabled = (activeFrames.length === 0);
    document.getElementById('menu-enable-all').disabled = !hasFrames;
    document.getElementById('menu-reverse-order').disabled = (this.frames.length < 2);
    document.getElementById('menu-clear-timeline').disabled = !hasFrames;
    document.getElementById('btn-play').disabled = (activeFrames.length === 0);
    document.getElementById('btn-prev').disabled = (this.frames.length < 2);
    document.getElementById('btn-next').disabled = (this.frames.length < 2);
    document.getElementById('btn-apply-delay').disabled = !hasFrames;

    if (hasFrames) {
      const modeName = ColorEngine.MODES[this.paletteMode]?.name || `Mode ${this.paletteMode}`;
      document.getElementById('info-grid').textContent = `${this.gridWidth}×${this.gridHeight} (${this.canvas.width}×${this.canvas.height}px)`;
      document.getElementById('info-palette').textContent = modeName;
      document.getElementById('info-active-frames').textContent = `${activeFrames.length} / ${this.frames.length}`;
      document.getElementById('info-duration').textContent = `${totalMs} ms`;
      document.getElementById('status-dims').textContent = `Grid: ${this.gridWidth}×${this.gridHeight} (${this.canvas.width}×${this.canvas.height}px)`;
      document.getElementById('timeline-hint').textContent = 'Space = Play/Pause • Left/Right = Step';
    } else {
      document.getElementById('info-grid').textContent = '--';
      document.getElementById('info-palette').textContent = '--';
      document.getElementById('info-active-frames').textContent = '0';
      document.getElementById('info-duration').textContent = '0 ms';
      document.getElementById('status-frame').textContent = 'Frame: 0 / 0';
      document.getElementById('status-dims').textContent = 'Grid: --';
      document.getElementById('timeline-hint').textContent = 'Load a project folder of .pxi frames to begin';
    }
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.animator = new PixelBannerAnimator();
});
  
