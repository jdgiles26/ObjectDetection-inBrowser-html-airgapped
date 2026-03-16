<!-- HEADER BANNER -->
<div align="center">

```
 ██████╗ ██████╗      ██╗███████╗ ██████╗████████╗    ██████╗ ███████╗████████╗███████╗ ██████╗████████╗
██╔═══██╗██╔══██╗     ██║██╔════╝██╔════╝╚══██╔══╝    ██╔══██╗██╔════╝╚══██╔══╝██╔════╝██╔════╝╚══██╔══╝
██║   ██║██████╔╝     ██║█████╗  ██║        ██║       ██║  ██║█████╗     ██║   █████╗  ██║        ██║
██║   ██║██╔══██╗██   ██║██╔══╝  ██║        ██║       ██║  ██║██╔══╝     ██║   ██╔══╝  ██║        ██║
╚██████╔╝██████╔╝╚█████╔╝███████╗╚██████╗   ██║       ██████╔╝███████╗   ██║   ███████╗╚██████╗   ██║
 ╚═════╝ ╚═════╝  ╚════╝ ╚══════╝ ╚═════╝   ╚═╝       ╚═════╝ ╚══════╝   ╚═╝   ╚══════╝ ╚═════╝   ╚═╝
```

### 🔍 **AI-Powered Object Detection · Runs 100% in Your Browser · No Server Required**

---

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](LICENSE)
[![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/HTML)
[![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![YOLO](https://img.shields.io/badge/YOLO-00FFFF?style=for-the-badge&logo=yolo&logoColor=black)](https://pjreddie.com/darknet/yolo/)
[![MediaPipe](https://img.shields.io/badge/MediaPipe-0097A7?style=for-the-badge&logo=google&logoColor=white)](https://mediapipe.dev/)
[![Airgapped](https://img.shields.io/badge/Airgapped-✅_Works_Offline-brightgreen?style=for-the-badge)]()
[![Mobile](https://img.shields.io/badge/Mobile_Friendly-📱-blue?style=for-the-badge)]()

</div>

---

## 🚀 What Is This?

A curated, **production-ready** collection of **HTML-only** object detection templates powered by **YOLO** and **MediaPipe**. Every template is:

- 📄 **Single-file** — one `.html` file, zero dependencies to install
- ✈️ **Airgapped** — works with **no internet connection** after initial load (or fully self-hosted)
- 📱 **Cross-platform** — runs on desktop Chrome/Firefox/Edge and mobile Safari/Chrome
- ⚡ **Real-time** — leverages WebAssembly, WebGL, and browser-native ML inference
- 🔒 **Privacy-first** — all processing happens on-device; no data ever leaves your machine

---

## 🗂️ Template Gallery

> Each template is a standalone `.html` file. Open it in any modern browser and go!

<div align="center">

| # | Template | Model | Use Case | Difficulty |
|---|----------|-------|----------|------------|
| 🟢 | **[Basic Object Detector](#)** | YOLOv8n | General detection (80 classes) | Beginner |
| 🟡 | **[Live Camera Feed Detector](#)** | YOLOv8s | Real-time webcam inference | Beginner |
| 🔵 | **[Pose Estimation](#)** | MediaPipe Pose | Full-body skeleton tracking | Intermediate |
| 🟣 | **[Hand Gesture Detector](#)** | MediaPipe Hands | 21-point hand landmark | Intermediate |
| 🔴 | **[Face Mesh Overlay](#)** | MediaPipe FaceMesh | 468-point face landmark | Intermediate |
| ⚫ | **[Custom Model Loader](#)** | YOLOv8 (ONNX) | Load your own trained model | Advanced |
| 🟤 | **[Multi-Model Switcher](#)** | YOLOv8n/s/m | Compare model sizes live | Advanced |
| 🌟 | **[Dark Mode HUD](#)** | YOLOv8n | Tactical AR-style overlay | Creative |
| 🎨 | **[Neon Bounding Boxes](#)** | YOLOv8s | Cyberpunk aesthetic | Creative |
| 🗺️ | **[Heatmap Attention](#)** | YOLOv8n | Detection confidence heatmap | Advanced |

</div>

---

## ✨ Feature Highlights

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│   🎯  Real-time YOLO inference via ONNX Runtime Web                 │
│   🧠  MediaPipe Tasks (Pose · Hands · Face · Object)                │
│   📦  Fully self-contained — embed models as base64 or CDN          │
│   🖼️  Canvas-based rendering with customizable overlays             │
│   🎛️  Live confidence threshold sliders & class filters             │
│   📊  FPS counter & performance metrics HUD                         │
│   🌐  Works on localhost, file://, LAN, or air-gapped intranets     │
│   📱  Touch-optimized controls for tablet & phone use               │
│   🎨  Multiple UI themes: Dark HUD · Neon · Minimal · Military      │
│   🔧  Easy-to-modify template structure for custom projects         │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## ⚡ Quick Start

Getting started takes **less than 60 seconds**:

```bash
# Option 1 — just open the file
# Download any template .html file and double-click it.

# Option 2 — serve locally (recommended for camera access on some browsers)
python -m http.server 8080
# Then open: http://localhost:8080/template-name.html

# Option 3 — host on your local network (airgapped intranet)
# Copy the .html file to any web server directory.
# No npm, no pip, no Docker needed.
```

> **📌 Tip:** Chrome and Edge require HTTPS or `localhost` for webcam access.  
> Use `python -m http.server` or any static file server for local testing.

---

## 🧰 Technology Stack

<div align="center">

| Layer | Technology | Purpose |
|-------|-----------|---------|
| 🏗️ Structure | HTML5 + Canvas API | Single-file template container |
| 🧠 Inference | ONNX Runtime Web (WebAssembly/WebGL) | Run YOLO models in browser |
| 👁️ Vision | MediaPipe Tasks JS | Pose, Hands, Face detection |
| 🎨 Rendering | Canvas 2D / WebGL | Bounding boxes & overlays |
| 📷 Camera | getUserMedia API | Live webcam feed capture |
| 🚀 Acceleration | WebGL2 / WASM SIMD | GPU & CPU optimised inference |
| 🔡 Models | YOLOv8n · YOLOv8s · YOLOv8m (ONNX) | Nano → Small → Medium accuracy |

</div>

---

## 📐 Template Architecture

Every template follows a consistent, readable structure so you can customize it easily:

```
template.html
│
├── <head>
│   ├── Inline CSS (theme variables, layout)
│   └── CDN / embedded model loader scripts
│
├── <body>
│   ├── <video>   — hidden camera feed source
│   ├── <canvas>  — rendered output with overlays
│   └── Controls  — threshold sliders, class filter, FPS display
│
└── <script>
    ├── Model initialisation
    ├── Inference loop (requestAnimationFrame)
    ├── Post-processing (NMS, confidence filter)
    └── Rendering (boxes, labels, skeletons)
```

---

## 🎨 UI Themes Preview

```
╔══════════════════════╗   ╔══════════════════════╗   ╔══════════════════════╗
║  🌑  DARK HUD        ║   ║  🌈  NEON CYBERPUNK  ║   ║  🪖  MILITARY TACTICAL║
║──────────────────────║   ║──────────────────────║   ║──────────────────────║
║  ┌──────────────┐    ║   ║  ╔══════════════╗    ║   ║  ╔══════════════╗    ║
║  │  person 0.97 │    ║   ║  ║ PERSON 0.97  ║    ║   ║  ║  TGT: HUMAN  ║    ║
║  │  ╔════════╗  │    ║   ║  ║ ░░▓▓▓▓▓▓░░  ║    ║   ║  ║  CONF: 97%   ║    ║
║  │  ║ [BODY] ║  │    ║   ║  ║ ▓▓▓▓▓▓▓▓▓▓  ║    ║   ║  ║  ████████    ║    ║
║  │  ╚════════╝  │    ║   ║  ╚══════════════╝    ║   ║  ╚══════════════╝    ║
║  └──────────────┘    ║   ║  [00FF FF glow]       ║   ║  [#4CAF50 green]    ║
║  FPS: 28  ■■■■■□     ║   ║  FPS: 30  ●●●●●      ║   ║  FPS: 25  ▓▓▓▓▓░   ║
╚══════════════════════╝   ╚══════════════════════╝   ╚══════════════════════╝
```

---

## 🗺️ Roadmap

- [x] YOLO v8 Nano real-time detection template
- [x] MediaPipe Pose landmark overlay
- [x] MediaPipe Hands gesture detection
- [x] Face Mesh 468-point template
- [x] Custom ONNX model loader
- [ ] YOLOv9 / YOLOv10 templates
- [ ] Segment Anything Model (SAM) lightweight template
- [ ] WebGPU-accelerated inference template
- [ ] Drag-and-drop image/video file detection
- [ ] QR/Barcode detector template
- [ ] OCR + Object detection combo template
- [ ] Multi-camera / multi-stream template

---

## 🤝 Contributing

Contributions are warmly welcome! To add a new template:

1. **Fork** this repository
2. Create a new branch: `git checkout -b feature/my-cool-template`
3. Add your `.html` template to the root (or a relevant subfolder)
4. Follow the [template architecture](#-template-architecture) above
5. Open a **Pull Request** with a short description of what it does

**Template naming convention:**
```
yolo-<model>-<use-case>[-<theme>].html
mediapipe-<task>-<use-case>[-<theme>].html

# Examples:
yolo-v8n-object-detection-neon.html
mediapipe-pose-skeleton-military.html
yolo-v8s-custom-model-loader.html
```

---

## 📜 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

```
Copyright (c) 2026 Joshua Giles
Free to use, modify, and distribute.
```

---

<div align="center">

**⭐ If this saves you time, please star the repo! ⭐**

Made with ❤️ by [jdgiles26](https://github.com/jdgiles26) · Powered by YOLO + MediaPipe + Pure HTML

</div>
