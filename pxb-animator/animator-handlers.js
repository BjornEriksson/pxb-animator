/**
 * PixelBanner (.pxb) Animator - UI & Keyboard Event Handlers
 * @file animator-handlers.js
 * @author BjornEriksson (https://github.com)
 * @version 0.1.0-beta
 */
function setupAnimatorHandlers(app) {
  const folderInput = document.getElementById('folder-input-pxi');
  const filesInput = document.getElementById('files-input-pxi');
  const pxbInput = document.getElementById('file-input-pxb');

  document.getElementById('menu-new-pxb').onclick = () => {
    app.stopPlayback();
    app.frames = [];
    app.selectedIndex = -1;
    app.gridWidth = 0;
    app.gridHeight = 0;
    app.loop = true;
    document.getElementById('chk-loop').checked = true;
    document.getElementById('creator-signature').value = '';
    app.ctx.clearRect(0, 0, app.canvas.width, app.canvas.height);
    TimelineUI.rebuild(app);
    app.updateUIState();
    app.setStatus('Ready for new animation');
  };

  document.getElementById('menu-load-folder').onclick = () => folderInput.click();
  document.getElementById('menu-add-pxi').onclick = () => filesInput.click();
  document.getElementById('menu-open-pxb').onclick = () => pxbInput.click();
  document.getElementById('menu-save-pxb').onclick = () => app.savePxbFile();

  folderInput.onchange = async (e) => {
    if (e.target.files.length > 0) {
      await app.importPxiFiles(Array.from(e.target.files), true);
    }
    e.target.value = '';
  };

  filesInput.onchange = async (e) => {
    if (e.target.files.length > 0) {
      await app.importPxiFiles(Array.from(e.target.files), false);
    }
    e.target.value = '';
  };

  pxbInput.onchange = async (e) => {
    if (e.target.files.length > 0) {
      await app.openPxbFile(e.target.files.item(0));
    }
    e.target.value = '';
  };

  // Timeline Menu Actions
  document.getElementById('menu-enable-all').onclick = () => {
    app.frames.forEach((f) => { f.enabled = true; });
    TimelineUI.rebuild(app);
    app.updateUIState();
    app.setStatus('All frames enabled');
  };

  document.getElementById('menu-reverse-order').onclick = () => {
    app.stopPlayback();
    app.frames.reverse();
    app.selectedIndex = app.frames.length > 0 ? 0 : -1;
    TimelineUI.rebuild(app);
    app.renderCurrentFrame();
    app.updateUIState();
    app.setStatus('Frame order reversed');
  };

  document.getElementById('menu-clear-timeline').onclick = () => {
    app.stopPlayback();
    app.frames = [];
    app.selectedIndex = -1;
    app.gridWidth = 0;
    app.gridHeight = 0;
    app.ctx.clearRect(0, 0, app.canvas.width, app.canvas.height);
    TimelineUI.rebuild(app);
    app.updateUIState();
    app.setStatus('Timeline cleared');
  };

  // Transport & Playback Controls
  document.getElementById('btn-play').onclick = () => app.togglePlayback();
  document.getElementById('btn-prev').onclick = () => app.stepFrame(-1);
  document.getElementById('btn-next').onclick = () => app.stepFrame(1);

  document.getElementById('chk-loop').onchange = (e) => {
    app.loop = e.target.checked;
  };

  document.getElementById('btn-apply-delay').onclick = () => {
    const delay = app.clampDelay(document.getElementById('global-delay-input').value);
    document.getElementById('global-delay-input').value = String(delay);
    app.frames.forEach((f) => { f.delayMs = delay; });
    TimelineUI.rebuild(app);
    app.updateUIState();
    app.setStatus(`Applied ${delay} ms to all frames`);
  };

  // Keyboard shortcuts (Space = Play/Pause, Left/Right = Step)
  window.addEventListener('keydown', (e) => {
    if (document.activeElement && ['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;
    if (app.frames.length === 0) return;

    if (e.code === 'Space') {
      e.preventDefault();
      app.togglePlayback();
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      app.stepFrame(-1);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      app.stepFrame(1);
    }
  });
}
