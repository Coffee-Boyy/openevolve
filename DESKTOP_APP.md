# OpenEvolve Desktop Application

This repository now includes a fully-featured desktop application built with Electron, React, and TypeScript.

## 🎯 Features

- **Real-time Evolution Monitoring**: Watch your code evolve with live updates
- **Interactive Visualization**: D3.js-powered force-directed graph of evolution tree
- **Evolution Control**: Start, stop, and pause evolution runs with a click
- **Configuration Editor**: Built-in YAML editor with syntax highlighting and validation
- **Live Logs**: Real-time log streaming from the Python backend
- **Cross-Platform**: Works on macOS, Windows, and Linux
- **Dark/Light Mode**: Integrated theme support

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- Python 3.10+
- npm or pnpm

### Development

1. **Install dependencies:**
   ```bash
   cd desktop
   npm install
   cd ..
   pip install -e ".[dev]"
   ```

2. **Run the development app:**
   ```bash
   cd desktop
   npm run electron:dev
   ```

This will:
- Start the Vite dev server
- Launch the Python FastAPI backend
- Open the Electron window

### Production Build

Build for your current platform:
```bash
cd desktop
npm run build
```

Or build for specific platforms:
```bash
npm run build:mac    # macOS
npm run build:win    # Windows
npm run build:linux  # Linux
```

Built apps will be in `desktop/release/<version>/`.

## 📁 Project Structure

```
openevolve/
├── desktop/                      # Electron desktop app
│   ├── src/
│   │   ├── main/                 # Electron main process
│   │   ├── preload/              # Preload bridge
│   │   └── renderer/             # React UI
│   ├── package.json
│   ├── vite.config.ts
│   └── README.md
├── openevolve/
│   ├── server_api/               # FastAPI backend for desktop
│   │   ├── server.py             # Main server entry point
│   │   ├── routes/               # API endpoints
│   │   └── websocket.py          # WebSocket manager
│   └── ... (existing OpenEvolve code)
└── ... (existing files)
```

## 🏗️ Architecture

The desktop app consists of three main components:

1. **Electron Shell** (TypeScript)
   - Manages app lifecycle
   - Spawns Python backend
   - Provides native OS integration

2. **React UI** (TypeScript + React 18)
   - Modern, responsive interface
   - Real-time updates via WebSocket
   - D3.js visualizations
   - Monaco editor integration

3. **Python Backend** (FastAPI)
   - RESTful API for evolution control
   - WebSocket for real-time updates
   - Integration with existing OpenEvolve core

```
┌─────────────────────────────────────┐
│         Electron Desktop            │
│  ┌──────────────┐  ┌──────────────┐│
│  │ React UI     │  │ Main Process ││
│  │ (Renderer)   │◄─┤ (Node.js)    ││
│  └──────┬───────┘  └──────┬───────┘│
│         │                  │        │
│         │ HTTP/WebSocket   │ Spawns │
└─────────┼──────────────────┼────────┘
          │                  │
          ▼                  ▼
    ┌──────────────────────────────┐
    │   Python FastAPI Backend     │
    │  ┌────────────────────────┐  │
    │  │  OpenEvolve Core       │  │
    │  │  (Evolution Engine)    │  │
    │  └────────────────────────┘  │
    └──────────────────────────────┘
```

## 🎨 UI Components

### Dashboard
- Evolution status panel
- Start/stop/pause controls
- Progress tracking
- Backend health monitoring

### Evolution Visualizer
- Interactive force-directed graph
- Node coloring by island
- Node sizing by fitness score
- Zoom and pan controls
- Click to view program details

### Configuration Editor
- Monaco editor with YAML support
- Syntax highlighting
- Real-time validation
- Load/save config files

### Log Viewer
- Real-time log streaming
- Level filtering (Debug, Info, Warning, Error)
- Search functionality
- Auto-scroll toggle

## 📚 Documentation

- [Desktop App README](desktop/README.md) - Complete setup and usage guide
- [Testing Guide](desktop/TESTING.md) - Comprehensive testing instructions
- [Main README](README.md) - OpenEvolve core documentation

## 🔧 Development Tips

### Debugging

1. **Frontend**: Open DevTools in Electron (View > Toggle Developer Tools)
2. **Backend**: Check Python logs in the terminal or Electron console
3. **Network**: Use DevTools Network tab to inspect API calls

### Hot Reload

The development environment supports hot reload:
- React components reload automatically
- Electron main process restarts on changes
- Python backend needs manual restart (Ctrl+C and rerun)

### Common Issues

**Python backend fails to start:**
- Ensure FastAPI is installed: `pip install fastapi uvicorn websockets`
- Check the path in `pythonManager.ts` matches your setup
- Verify Python is in your PATH

**UI doesn't update:**
- Check WebSocket connection in DevTools Console
- Verify backend is running on port 8765
- Check CORS settings if developing with external backend

## 🤝 Contributing

The desktop app follows the same contribution guidelines as the main project. See [CONTRIBUTING.md](CONTRIBUTING.md) for details.

When contributing to the desktop app:
1. Test on multiple platforms if possible
2. Ensure TypeScript types are correct
3. Follow React best practices
4. Update documentation for new features

## 📄 License

Apache-2.0 - Same as the main OpenEvolve project.

## 🙏 Acknowledgments

The desktop app builds upon:
- [Electron](https://www.electronjs.org/)
- [React](https://react.dev/)
- [Vite](https://vitejs.dev/)
- [D3.js](https://d3js.org/)
- [FastAPI](https://fastapi.tiangolo.com/)
- And all the amazing OpenEvolve contributors!
