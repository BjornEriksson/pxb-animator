/**
 * PixelBanner (.pxb) Animator - Multi-Frame Binary Encoder & Decoder
 * @file pxb-codec.js
 * @author BjornEriksson (https://github.com)
 * @version 0.1.0-beta
 */
const PxbCodec = {
  writeEncodedPixel(view, offset, encoded, bytesPerPixel) {
    if (bytesPerPixel === 1) {
      view.setUint8(offset, encoded);
    } else if (bytesPerPixel === 2) {
      view.setUint16(offset, encoded, false);
    } else {
      view.setUint8(offset, (encoded >> 16) & 0xFF);
      view.setUint8(offset + 1, (encoded >> 8) & 0xFF);
      view.setUint8(offset + 2, encoded & 0xFF);
    }
  },

  /**
   * Encode an animation state into a binary .pxb ArrayBuffer.
   * state.frames: Array of { pixels: Uint32Array, delayMs: number }
   */
  encode(state) {
    const frames = state.frames || [];
    if (frames.length < 1 || frames.length > 255) {
      throw new Error('Invalid frameCount: .pxb supports 1 to 255 frames');
    }

    const mode = state.paletteMode ?? ColorEngine.MODE_9BIT;
    const pixelCount = state.gridWidth * state.gridHeight;
    const bytesPerPixel = (mode === ColorEngine.MODE_8BIT) ? 1 : (mode === ColorEngine.MODE_24BIT ? 3 : 2);
    const rawFrameBytes = pixelCount * bytesPerPixel;

    // Pre-encode all frames and build RLE candidates to evaluate total size savings
    let totalRawBytes = 0;
    let totalRleBytes = 0;
    const preparedFrames = frames.map((frame) => {
      const encodedPixels = new Uint32Array(pixelCount);
      for (let i = 0; i < pixelCount; i++) {
        encodedPixels[i] = ColorEngine.encodePixel(frame.pixels[i], mode);
      }

      const rleRuns = [];
      let idx = 0;
      while (idx < pixelCount) {
        const val = encodedPixels[idx];
        let run = 1;
        while (idx + run < pixelCount && encodedPixels[idx + run] === val && run < 255) {
          run++;
        }
        rleRuns.push({ run, val });
        idx += run;
      }

      const rleSize = rleRuns.length * (1 + bytesPerPixel);
      totalRawBytes += rawFrameBytes;
      totalRleBytes += rleSize;

      const delayMs = Math.max(1, Math.min(65535, Math.round(Number(frame.delayMs) || 100)));
      return { delayMs, encodedPixels, rleRuns };
    });

    // Enable global RLE flag (0x02) if RLE saves bytes across the animation
    const useRle = totalRleBytes < totalRawBytes;
    const framesPayloadBytes = preparedFrames.reduce((sum, f) => {
      const dataBytes = useRle ? (f.rleRuns.length * (1 + bytesPerPixel)) : rawFrameBytes;
      return sum + 2 + dataBytes; // 2 bytes for uint16 delayMs
    }, 0);

    const sig = (state.signature || '').trim();
    const sigBytes = sig ? new TextEncoder().encode(sig).slice(0, 64) : null;
    const totalBytes = 16 + framesPayloadBytes + (sigBytes ? 1 + sigBytes.length : 0);

    const buffer = new ArrayBuffer(totalBytes);
    const view = new DataView(buffer);

    // 16-byte shared Big-Endian header
    view.setUint8(0, 0x50); // 'P'
    view.setUint8(1, 0x58); // 'X'
    view.setUint8(2, 0x42); // 'B'
    view.setUint8(3, 0x01); // Version 1
    view.setUint16(4, state.gridWidth, false);
    view.setUint16(6, state.gridHeight, false);
    view.setUint8(8, state.pixelScale);
    view.setUint8(9, state.rasterStyle);

    const rasterMode = (mode === ColorEngine.MODE_24BIT) ? ColorEngine.MODE_9BIT : mode;
    view.setUint16(10, ColorEngine.encodePixel(state.rasterColor24, rasterMode), false);

    view.setUint8(12, mode);
    view.setUint8(13, frames.length);
    view.setUint8(14, state.rasterThickness);

    let flags = 0x00;
    if (state.loop !== false) flags |= 0x01;
    if (useRle) flags |= 0x02;
    if (sigBytes) flags |= 0x08;
    view.setUint8(15, flags);

    // Write frame sequence
    let offset = 16;
    for (let f = 0; f < preparedFrames.length; f++) {
      const frame = preparedFrames[f];
      view.setUint16(offset, frame.delayMs, false);
      offset += 2;

      if (useRle) {
        for (let r = 0; r < frame.rleRuns.length; r++) {
          view.setUint8(offset++, frame.rleRuns[r].run);
          this.writeEncodedPixel(view, offset, frame.rleRuns[r].val, bytesPerPixel);
          offset += bytesPerPixel;
        }
      } else {
        for (let i = 0; i < pixelCount; i++) {
          this.writeEncodedPixel(view, offset, frame.encodedPixels[i], bytesPerPixel);
          offset += bytesPerPixel;
        }
      }
    }

    // Optional creator signature at EOF
    if (sigBytes) {
      view.setUint8(offset, sigBytes.length);
      new Uint8Array(buffer).set(sigBytes, offset + 1);
    }

    return buffer;
  },

  /**
   * Decode a binary .pxb ArrayBuffer into an animation object.
   */
  decode(buffer) {
    const view = new DataView(buffer);
    if (view.byteLength < 16 || view.getUint8(0) !== 0x50 || view.getUint8(1) !== 0x58 || view.getUint8(2) !== 0x42) {
      throw new Error('Invalid .pxb signature');
    }

    const gridWidth = view.getUint16(4, false);
    const gridHeight = view.getUint16(6, false);
    const pixelScale = view.getUint8(8);
    const rasterStyle = view.getUint8(9);
    const rawRaster = view.getUint16(10, false);
    const paletteMode = view.getUint8(12);
    const frameCount = view.getUint8(13);
    const rasterThickness = view.getUint8(14);
    const flags = view.getUint8(15);

    if (frameCount < 1) {
      throw new Error('Invalid .pxb frame count');
    }

    const loop = (flags & 0x01) !== 0;
    const isRle = (flags & 0x02) !== 0;
    const hasSignature = (flags & 0x08) !== 0;

    const rasterMode = (paletteMode === ColorEngine.MODE_24BIT) ? ColorEngine.MODE_9BIT : paletteMode;
    const rasterColor24 = ColorEngine.decodePixel(rawRaster, rasterMode);

    const pixelCount = gridWidth * gridHeight;
    const bytesPerPixel = (paletteMode === ColorEngine.MODE_8BIT) ? 1 : (paletteMode === ColorEngine.MODE_24BIT ? 3 : 2);
    let offset = 16;

    const readPixel = () => {
      let rawVal = 0;
      if (bytesPerPixel === 1) {
        rawVal = view.getUint8(offset);
      } else if (bytesPerPixel === 2) {
        rawVal = view.getUint16(offset, false);
      } else {
        rawVal = (view.getUint8(offset) << 16) | (view.getUint8(offset + 1) << 8) | view.getUint8(offset + 2);
      }
      offset += bytesPerPixel;
      return ColorEngine.decodePixel(rawVal, paletteMode);
    };

    const frames = [];
    for (let f = 0; f < frameCount; f++) {
      const delayMs = view.getUint16(offset, false);
      offset += 2;

      const pixels = new Uint32Array(pixelCount);
      if (isRle) {
        let written = 0;
        while (written < pixelCount && offset < buffer.byteLength) {
          const run = view.getUint8(offset++);
          const col24 = readPixel();
          for (let r = 0; r < run && written < pixelCount; r++) {
            pixels[written++] = col24;
          }
        }
      } else {
        for (let i = 0; i < pixelCount; i++) {
          pixels[i] = readPixel();
        }
      }

      frames.push({ pixels, delayMs, enabled: true });
    }

    let signature = '';
    if (hasSignature && offset < buffer.byteLength) {
      const len = view.getUint8(offset);
      signature = new TextDecoder().decode(new Uint8Array(buffer, offset + 1, len));
    }

    return {
      gridWidth,
      gridHeight,
      pixelScale,
      rasterStyle,
      rasterColor24,
      paletteMode,
      rasterThickness,
      loop,
      frames,
      signature
    };
  }
};
