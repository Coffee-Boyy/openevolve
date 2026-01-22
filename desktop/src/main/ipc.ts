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

  // Get evolution data for visualization
  ipcMain.handle('evolution:getData', async (_, runId: string) => {
    const engine = activeRuns.get(runId);
    if (!engine) {
      throw new Error('Run not found');
    }

    return engine.exportEvolutionData();
  });

  // Get program details by ID
  ipcMain.handle('evolution:getProgram', async (_, runId: string, programId: string) => {
    const engine = activeRuns.get(runId);
    if (!engine) {
      throw new Error('Run not found');
    }

    const program = engine.getProgram(programId);
    if (!program) {
      throw new Error('Program not found');
    }

    // Return program data in the format expected by ProgramViewer
    return {
      id: program.id,
      code: program.code,
      metrics: program.metrics,
      generation: program.generation,
      island: program.metadata.island || 0,
      parent_id: program.parentId,
      iteration: program.iterationFound,
      method: program.metadata.method,
      artifacts_json: program.artifactsJson ? JSON.parse(program.artifactsJson) : undefined,
    };
  });

  // Get evolution logs
  ipcMain.handle('evolution:getLogs', async (_, runId: string) => {
    const engine = activeRuns.get(runId);
    if (!engine) {
      throw new Error('Run not found');
    }

    const outputDir = engine.getOutputDir();
    const logFile = path.join(outputDir, 'evolution.log');

    try {
      // Try to read log file if it exists
      if (await fs.access(logFile).then(() => true).catch(() => false)) {
        const logContent = await fs.readFile(logFile, 'utf-8');
        // Parse log file - format: [timestamp] [level] message
        const lines = logContent.split('\n').filter(line => line.trim());
        const logs = lines.map((line) => {
          // Parse format: [timestamp] [level] message
          const timestampMatch = line.match(/\[(\d+)\]/);
          const levelMatch = line.match(/\[(INFO|WARNING|ERROR|DEBUG)\]/);
          
          let timestamp = Date.now() / 1000;
          if (timestampMatch) {
            timestamp = parseInt(timestampMatch[1], 10);
          }
          
          let level: 'debug' | 'info' | 'warning' | 'error' = 'info';
          if (levelMatch) {
            const levelStr = levelMatch[1].toUpperCase();
            if (levelStr === 'INFO' || levelStr === 'DEBUG') {
              level = levelStr.toLowerCase() as 'info' | 'debug';
            } else if (levelStr === 'WARNING') {
              level = 'warning';
            } else if (levelStr === 'ERROR') {
              level = 'error';
            }
          }
          
          // Remove timestamp and level markers to get the message
          const message = line.replace(/\[\d+\]\s*\[(INFO|WARNING|ERROR|DEBUG)\]\s*/, '').trim();
          
          return {
            timestamp,
            level,
            message: message || line.trim(), // Fallback to full line if parsing fails
            source: 'evolution',
          };
        });

        return { logs };
      } else {
        // If no log file exists, return empty logs
        // In the future, we could capture console.log output
        return { logs: [] };
      }
    } catch (error) {
      console.error('Failed to read log file:', error);
      return { logs: [] };
    }
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
      // #region agent log
      const logPayload = JSON.stringify({location:'ipc.ts:108',message:'config:save IPC handler called',data:{configPath:configPath,configPathType:typeof configPath,hasConfig:!!config,configKeys:config ? Object.keys(config).slice(0,5) : []},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'A,B,D'});
      await fs.appendFile('/Users/connor/projects/openevolve/.cursor/debug.log', logPayload + '\n').catch(()=>{});
      // #endregion
      
      const { saveConfig } = await import('./engine/config');
      
      // #region agent log
      const logPayload2 = JSON.stringify({location:'ipc.ts:115',message:'Before saveConfig call',data:{configPath:configPath,configPathIsUndefined:configPath===undefined},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'D'});
      await fs.appendFile('/Users/connor/projects/openevolve/.cursor/debug.log', logPayload2 + '\n').catch(()=>{});
      // #endregion
      
      saveConfig(config, configPath);
      
      // #region agent log
      const logPayload3 = JSON.stringify({location:'ipc.ts:121',message:'After saveConfig call - success',data:{},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'D'});
      await fs.appendFile('/Users/connor/projects/openevolve/.cursor/debug.log', logPayload3 + '\n').catch(()=>{});
      // #endregion
      
      return { success: true };
    } catch (error) {
      // #region agent log
      const logPayload4 = JSON.stringify({location:'ipc.ts:128',message:'config:save error',data:{errorMessage:error instanceof Error ? error.message : String(error),errorStack:error instanceof Error ? error.stack : ''},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'D'});
      await fs.appendFile('/Users/connor/projects/openevolve/.cursor/debug.log', logPayload4 + '\n').catch(()=>{});
      // #endregion
      
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
