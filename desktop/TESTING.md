# Testing Guide for OpenEvolve Desktop

This document provides instructions for testing the desktop application.

## Development Testing

### 1. Start Development Environment

```bash
cd desktop
pnpm run electron:dev
```

This starts both the React dev server and Electron app.

### 2. Verify Application Startup

1. Check that the app window opens successfully
2. Open DevTools (View > Toggle Developer Tools)
3. Check console for any errors
4. Verify the status panel shows the run status correctly

### 3. Test Evolution Run

#### Prerequisites
- Configure LLM API keys in environment variables (OPENAI_API_KEY, ANTHROPIC_API_KEY, etc.)
- Prepare or load initial program and evaluator code in the Setup tab

#### Steps
1. Go to the "Setup" tab
2. Load or write initial program code (TypeScript/JavaScript)
3. Load or write evaluator code (must export an `evaluate` function)
4. Click "Start Evolution" button in the status panel
5. Optional: Select config file (e.g., `config.yaml`)
6. Verify:
   - Status changes to "Running"
   - Iteration counter updates
   - Progress bar increases
   - Best score updates (if available)

#### Stop Evolution
1. Click "Stop Evolution" button while running
2. Verify status changes to "Stopped"
3. Verify progress is saved

### 4. Test Evolution Visualizer

1. Switch to "Evolution" tab
2. Verify graph renders after some iterations
3. Test interactions:
   - Zoom in/out (scroll wheel)
   - Pan (click and drag)
   - Select nodes (click on circles)
   - Verify node details panel appears
4. Check node coloring by island
5. Verify node sizes correlate with scores

### 5. Test Configuration Editor

1. Switch to "Configuration" tab
2. Verify YAML loads correctly
3. Make changes to config
4. Verify "unsaved changes" indicator
5. Click "Save" and verify success
6. Click "Reset" and verify changes revert
7. Test "Load File" and "Save File" buttons

### 6. Test Log Viewer

1. Switch to "Logs" tab
2. Verify logs appear during evolution
3. Test filtering:
   - Search by text
   - Filter by level (Info, Warning, Error)
4. Test "Auto-scroll" checkbox
5. Test "Clear" button

### 7. Test Theme Switching

1. Toggle dark/light mode switch in header
2. Verify:
   - Colors update correctly
   - Monaco editor theme changes
   - Graph colors adapt to theme
   - All components remain readable

### 8. Test Menu Integration

Test the following menu items work:
- File > Open Project
- File > Preferences
- Evolution > Start Run
- Evolution > Stop Run

## Production Build Testing

### Build the Application

```bash
# For your current platform
pnpm run build

# For specific platforms
pnpm run build:mac
pnpm run build:win
pnpm run build:linux
```

### Test Built Application

#### macOS
1. Open `release/<version>/OpenEvolve.dmg`
2. Drag to Applications
3. Open from Applications folder
4. Verify app starts without errors
5. Test all functionality as in development testing

#### Windows
1. Run installer from `release/<version>/OpenEvolve-<version>-x64.exe`
2. Complete installation
3. Launch from Start Menu
4. Verify app starts without errors
5. Test all functionality

#### Linux
1. Install AppImage:
   ```bash
   chmod +x release/<version>/OpenEvolve-<version>.AppImage
   ./release/<version>/OpenEvolve-<version>.AppImage
   ```
2. Or install .deb:
   ```bash
   sudo dpkg -i release/<version>/OpenEvolve-<version>.deb
   ```
3. Test all functionality

### Critical Checks for Production

- [ ] No console errors on startup
- [ ] All UI elements render correctly
- [ ] File dialogs work (open/save)
- [ ] Evolution runs complete successfully
- [ ] Visualization renders correctly
- [ ] Configuration persists across restarts
- [ ] Setup code persists across restarts
- [ ] Logs display in real-time
- [ ] App closes cleanly (no hanging processes)

## Platform-Specific Testing

### macOS
- [ ] App icon displays correctly
- [ ] DMG installer works
- [ ] Code signing valid (if signed)
- [ ] Notarization passes (if notarized)
- [ ] Both x64 and ARM64 builds work

### Windows
- [ ] App icon displays correctly
- [ ] NSIS installer works
- [ ] Start menu shortcut created
- [ ] Uninstaller works
- [ ] No Windows Defender warnings

### Linux
- [ ] AppImage runs without dependencies
- [ ] .deb package installs cleanly
- [ ] .rpm package installs cleanly
- [ ] Desktop file integration works

## Performance Testing

### Stress Tests

1. **Large Evolution Run**:
   - Start run with 1000+ iterations
   - Monitor memory usage
   - Verify no memory leaks
   - Check CPU usage stays reasonable

2. **Graph Rendering**:
   - Load checkpoint with 500+ nodes
   - Test zoom/pan performance
   - Verify no lag during interaction

3. **Log Volume**:
   - Generate many logs quickly
   - Verify UI remains responsive
   - Check auto-scroll performance

## Error Handling

Test error scenarios:

1. **Evolution Engine Failure**:
   - Test with invalid evaluator code
   - Verify app shows appropriate error
   - Test recovery and retry

2. **Invalid Configuration**:
   - Enter invalid YAML
   - Verify validation errors shown
   - Test recovery

3. **Missing Files**:
   - Try to load non-existent files
   - Verify error messages
   - Test graceful handling

4. **API Issues**:
   - Test with invalid API keys
   - Verify error messages for LLM failures
   - Test rate limiting handling

## Bug Reporting

When reporting bugs, include:

1. Platform and version (e.g., "macOS 13.5, OpenEvolve 1.0.0")
2. Steps to reproduce
3. Expected behavior
4. Actual behavior
5. Screenshots/videos if applicable
6. Console logs from DevTools (both main and renderer processes)

## Continuous Testing

For ongoing development:

1. Run linter: `pnpm run lint`
2. Run type checker: `pnpm run type-check`
3. Test on all platforms before release
4. Document any new features in tests
