# PixelBanner (`.pxb`) Animator — Public Beta (v0.1.0)

**Author:** [@BjornEriksson](https://github.com)  
**Version:** `0.1.0-beta`

**PixelBanner Animator** is a lightweight, zero-dependency, browser-based timeline assembler and animation tool built as a companion to **PixelImage (`.pxi`) Studio** [^1].

## Key Features (Beta v0.1.0)

* **Folder-Based `.pxi` Import:** Load and sort `.pxi` frame folders with strict validation [^1].
* **Non-Destructive Timeline Controls:** Adjust frame durations (`10–65,535 ms`), reorder, duplicate, or toggle individual frames [^1].
* **Real-Time Playback & Shortcuts:** Loop preview with `Space` for play/pause and arrow keys for frame stepping [^1].
* **Multi-Depth Color & Auto-RLE:** Supports 8-bit VGA up to 24-bit True Color palettes with automatic Run-Length Encoding [^1].
* **Round-Trip Editing & Architecture:** Re-open exported `.pxb` files for edits; built in vanilla HTML5 Canvas, CSS, and modular JavaScript without external dependencies [^1].

## Quick Start

1. Clone or download the repository and serve the root folder via a local web server (e.g., Live Server or Python `http.server`) [^1].
2. Open `pxb-animator/index.html` in your browser [^1].

## Project Structure

```text
pxb-animator/
├── style.css                  # Shared stylesheet
├── color-palettes.js          # VGA color tables
├── color.js                   # Multi-depth color engine (8/9/12/16/24-bit)
├── studio-config.js           # Configuration and presets
├── pxi-codec.js               # Binary .pxi v1 decoder
└── pxb-animator/
    ├── index.html             # Interface and timeline layout
    ├── animator.css           # Playback styling
    ├── pxb-codec.js           # .pxb v1 codec
    ├── timeline-ui.js         # Timeline renderer
    ├── animator-handlers.js   # Menu and event handlers
    └── animator.js            # Playback and state management
```

---

## Ecosystem Roadmap

This repository is part of a modular suite of pixel tools by [@BjornEriksson](https://github.com):
* **PixelImage (`.pxi`) Studio** *(Beta v0.4.1)* — Single-frame pixel editor and `.pxi` encoder/decoder.
* **PixelBanner (`.pxb`) Animator** *(Current Beta v0.1.0)* — Folder-based timeline assembler for combining `.pxi` frames into multi-frame animated `.pxb` banners and loops.

---

## License

This project is licensed under the [MIT License](LICENSE).
