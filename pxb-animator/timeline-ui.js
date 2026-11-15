/**
 * PixelBanner (.pxb) Animator - Timeline Strip Renderer
 * @file timeline-ui.js
 * @author BjornEriksson (https://github.com)
 * @version 0.1.0-beta
 */
const TimelineUI = {
  rebuild(app) {
    const track = document.getElementById('timeline-track');
    track.innerHTML = '';

    if (app.frames.length === 0) {
      track.innerHTML = '<div class="timeline-empty">No frames loaded yet. Use <strong>File → Load Folder of .pxi Frames...</strong></div>';
      return;
    }

    app.frames.forEach((frame, idx) => {
      const card = document.createElement('div');
      card.className = 'frame-card' +
        (idx === app.selectedIndex ? ' selected' : '') +
        (!frame.enabled ? ' disabled' : '');

      // Top row: Frame # + Enable Checkbox
      const top = document.createElement('div');
      top.className = 'frame-card-top';
      const label = document.createElement('span');
      label.textContent = `#${idx + 1}`;
      label.title = frame.name;

      const chk = document.createElement('input');
      chk.type = 'checkbox';
      chk.checked = frame.enabled;
      chk.title = 'Include/exclude frame in export & playback';
      chk.onclick = (e) => {
        e.stopPropagation();
        frame.enabled = chk.checked;
        card.classList.toggle('disabled', !frame.enabled);
        app.updateUIState();
      };
      top.append(label, chk);

      // Thumbnail Canvas
      const thumbWrap = document.createElement('div');
      thumbWrap.className = 'frame-thumb-wrap';
      const thumbCanvas = document.createElement('canvas');
      app.renderPixelsToCanvas(thumbCanvas, frame.pixels);
      thumbWrap.appendChild(thumbCanvas);

      // Per-frame delay input (ms)
      const delayRow = document.createElement('div');
      delayRow.className = 'frame-delay-row';
      const delayLbl = document.createElement('span');
      delayLbl.textContent = 'ms:';
      const delayInp = document.createElement('input');
      delayInp.type = 'number';
      delayInp.min = '10';
      delayInp.max = '65535';
      delayInp.step = '10';
      delayInp.value = String(frame.delayMs);
      delayInp.onclick = (e) => e.stopPropagation();
      delayInp.onchange = () => {
        frame.delayMs = app.clampDelay(delayInp.value);
        delayInp.value = String(frame.delayMs);
        app.updateUIState();
      };
      delayRow.append(delayLbl, delayInp);

      // Reorder, Duplicate & Remove Controls
      const actions = document.createElement('div');
      actions.className = 'frame-actions';

      const btnLeft = document.createElement('button');
      btnLeft.type = 'button';
      btnLeft.textContent = '◀';
      btnLeft.title = 'Move Left';
      btnLeft.disabled = (idx === 0);
      btnLeft.onclick = (e) => { e.stopPropagation(); app.moveFrame(idx, -1); };

      const btnRight = document.createElement('button');
      btnRight.type = 'button';
      btnRight.textContent = '▶';
      btnRight.title = 'Move Right';
      btnRight.disabled = (idx === app.frames.length - 1);
      btnRight.onclick = (e) => { e.stopPropagation(); app.moveFrame(idx, 1); };

      const btnDup = document.createElement('button');
      btnDup.type = 'button';
      btnDup.textContent = '+';
      btnDup.title = 'Duplicate Frame';
      btnDup.disabled = (app.frames.length >= 255);
      btnDup.onclick = (e) => { e.stopPropagation(); app.duplicateFrame(idx); };

      const btnDel = document.createElement('button');
      btnDel.type = 'button';
      btnDel.textContent = '✕';
      btnDel.title = 'Remove from Timeline';
      btnDel.onclick = (e) => { e.stopPropagation(); app.removeFrame(idx); };

      actions.append(btnLeft, btnRight, btnDup, btnDel);

      card.onclick = () => {
        app.stopPlayback();
        app.selectFrame(idx);
      };

      card.append(top, thumbWrap, delayRow, actions);
      track.appendChild(card);
    });
  }
};
