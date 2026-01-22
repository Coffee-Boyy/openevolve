# OpenEvolve Desktop Application

A cross-platform desktop application for OpenEvolve - Evolutionary Coding with LLMs.

## Architecture

- **Frontend**: Electron + React 18 + TypeScript + Vite
- **Backend**: Node.js (Electron main process) via IPC
- **UI Components**: Radix UI + Tailwind CSS
- **Visualization**: D3.js
- **State Management**: Zustand

## Development Setup

### Prerequisites

- Node.js 18+ 
- pnpm (or npm/yarn)

### Installation

Install Node.js dependencies:
```bash
cd desktop
pnpm install
```

### Running in Development

The development environment runs the React app with Vite and the Electron shell concurrently:

```bash
pnpm run electron:dev
```

This will:
1. Start the Vite dev server on http://localhost:5173
2. Open the Electron window with the evolution engine running in the main process

### Building for Production

#### Build for current platform:
```bash
pnpm run build
```

#### Build for specific platforms:
```bash
# macOS
pnpm run build:mac

# Windows
pnpm run build:win

# Linux
pnpm run build:linux
```

The built applications will be in `release/<version>/`.

## Project Structure

```
desktop/
├── src/
│   ├── main/              # Electron main process
│   │   ├── index.ts       # Main entry point
│   │   ├── ipc.ts         # IPC handlers
│   │   ├── menu.ts        # Application menu
│   │   └── engine/        # TypeScript evolution engine
│   ├── preload/           # Preload scripts
│   │   └── index.ts       # Context bridge
│   └── renderer/          # React application
│       ├── App.tsx
│       ├── components/    # React components
│       ├── hooks/         # Custom hooks
│       ├── store/         # Zustand state management
│       └── api/           # API client
├── resources/             # App icons and assets
├── build/                 # Build configuration
├── package.json
├── vite.config.ts
├── tsconfig.json
└── electron-builder.yml
```

## Features

### Dashboard
- Real-time evolution status monitoring
- Start/stop evolution runs
- Progress tracking with visual indicators
- Setup initial programs and evaluators

### Evolution Visualizer
- Interactive D3.js force-directed graph
- Node coloring by island
- Node sizing by score
- Zoom and pan controls
- Node selection with details panel

### Configuration Editor
- Monaco editor with YAML syntax highlighting
- Real-time validation
- Load/save configuration files
- Dark/light theme support

### Log Viewer
- Real-time log streaming via IPC events
- Log level filtering
- Search functionality
- Auto-scroll capability

## Backend Architecture

The desktop app runs a TypeScript-based evolution engine in the Electron main process. Communication between the renderer (UI) and main process happens via IPC:

- **Evolution Control**: Start, stop evolution runs
- **Configuration**: Load and save configuration files
- **Real-time Updates**: Progress updates via IPC events
- **File System**: Read/write programs and evaluators

The engine is a complete TypeScript port of the Python backend, including:
- LLM integration (OpenAI, Anthropic, etc.)
- Database management
- Prompt templates and sampling
- Evaluation and scoring

## Packaging

### Code Signing

For production releases:

- **macOS**: Requires Apple Developer certificate and notarization
- **Windows**: Requires code signing certificate
- **Linux**: No signing required

## Troubleshooting

### Evolution fails to start

1. Check that setup code (initial program and evaluator) is configured in the Setup tab
2. Check logs in Electron DevTools console
3. Verify that the evaluator exports an `evaluate` function
4. Make sure LLM API keys are properly configured

### Build fails

1. Clean build artifacts: `rm -rf dist dist-electron release`
2. Reinstall dependencies: `rm -rf node_modules && pnpm install`
3. Check electron-builder logs

### Module type warnings

If you see "MODULE_TYPELESS_PACKAGE_JSON" warnings, these are harmless but can be ignored. The package.json is correctly configured with `"type": "module"`.

## License

Apache-2.0 - See LICENSE file in root directory
