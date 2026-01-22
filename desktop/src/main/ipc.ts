import { IpcMain, dialog, app, BrowserWindow } from 'electron';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { EvolutionEngine } from './engine/controller';
import { loadConfig, Config } from './engine/config';

// Store active evolution runs
const activeRuns = new Map<string, EvolutionEngine>();

export function setupIpcHandlers(ipcMain: IpcMain, mainWindow: BrowserWindow) {
  // Start evolution run
  ipcMain.handle('evolution:start', async (_, options: {
    initialProgramPath: string;
    evaluatorPath: string;
    configPath?: string;
    iterations?: number;
    outputDir?: string;
  }) => {
    try {
      // Load configuration
      const config: Config = options.configPath 
        ? loadConfig(options.configPath)
        : loadConfig();

      // Override iterations if specified
      if (options.iterations) {
        config.maxIterations = options.iterations;
      }

      // Create evolution engine
      const engine = new EvolutionEngine(
        options.initialProgramPath,
        options.evaluatorPath,
        config,
        options.outputDir
      );

      const runId = engine.getRunId();
      activeRuns.set(runId, engine);

      // Set up event listeners
      engine.on('progress', (data) => {
        mainWindow.webContents.send('evolution:progress', { runId, ...data });
      });

      engine.on('status', (status) => {
        mainWindow.webContents.send('evolution:status', { runId, ...status });
      });

      engine.on('error', (error) => {
        mainWindow.webContents.send('evolution:error', { 
          runId, 
          error: error instanceof Error ? error.message : String(error)
        });
      });

      // Start evolution in background
      engine.run().then(() => {
        mainWindow.webContents.send('evolution:complete', { runId });
      }).catch((error) => {
        mainWindow.webContents.send('evolution:error', { 
          runId, 
          error: error instanceof Error ? error.message : String(error)
        });
      });

      return { runId, status: 'started' };
    } catch (error) {
      throw new Error(`Failed to start evolution: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  });

  // Stop evolution run
  ipcMain.handle('evolution:stop', async (_, runId: string) => {
    const engine = activeRuns.get(runId);
    if (!engine) {
      throw new Error('Run not found');
    }

    engine.stop();
    return { status: 'stopped' };
  });

  // Get evolution status
  ipcMain.handle('evolution:getStatus', async (_, runId: string) => {
    const engine = activeRuns.get(runId);
    if (!engine) {
      throw new Error('Run not found');
    }

    return engine.getStatus();
  });

  // Get configuration
  ipcMain.handle('config:get', async (_, configPath?: string) => {
    try {
      const config = configPath ? loadConfig(configPath) : loadConfig();
      return config;
    } catch (error) {
      throw new Error(`Failed to load config: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  });

  // Save configuration
  ipcMain.handle('config:save', async (_, configPath: string, config: Config) => {
    try {
      const { saveConfig } = await import('./engine/config');
      saveConfig(config, configPath);
      return { success: true };
    } catch (error) {
      throw new Error(`Failed to save config: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  });

  // Show open dialog for selecting files
  ipcMain.handle('dialog:openFile', async (_, options) => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: options?.filters || [],
    });
    return result.filePaths[0] || null;
  });

  // Show open dialog for selecting directories
  ipcMain.handle('dialog:openDirectory', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
    });
    return result.filePaths[0] || null;
  });

  // Show save dialog
  ipcMain.handle('dialog:saveFile', async (_, options) => {
    const result = await dialog.showSaveDialog({
      filters: options?.filters || [],
      defaultPath: options?.defaultPath,
    });
    return result.filePath || null;
  });

  // Show message box
  ipcMain.handle('dialog:showMessage', async (_, options) => {
    const result = await dialog.showMessageBox({
      type: options.type || 'info',
      title: options.title,
      message: options.message,
      buttons: options.buttons || ['OK'],
    });
    return result.response;
  });

  // Read file content
  ipcMain.handle('fs:readFile', async (_, filePath: string) => {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return content;
    } catch (error) {
      throw new Error(`Failed to read file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  });

  // Write file content
  ipcMain.handle('fs:writeFile', async (_, filePath: string, content: string) => {
    try {
      await fs.writeFile(filePath, content, 'utf-8');
      return true;
    } catch (error) {
      throw new Error(`Failed to write file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  });

  // Get temporary directory for evolution runs
  ipcMain.handle('fs:getTempDir', async () => {
    try {
      const tempBase = os.tmpdir();
      const tempDir = path.join(tempBase, 'openevolve', `run-${Date.now()}`);
      await fs.mkdir(tempDir, { recursive: true });
      return tempDir;
    } catch (error) {
      throw new Error(`Failed to create temp directory: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  });
}
