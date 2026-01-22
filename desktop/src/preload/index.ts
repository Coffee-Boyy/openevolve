import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Evolution control
  startEvolution: (options: any) => ipcRenderer.invoke('evolution:start', options),
  stopEvolution: (runId: string) => ipcRenderer.invoke('evolution:stop', runId),
  getEvolutionStatus: (runId: string) => ipcRenderer.invoke('evolution:getStatus', runId),
  
  // Evolution events
  onEvolutionProgress: (callback: (data: any) => void) => {
    const listener = (_: any, data: any) => callback(data);
    ipcRenderer.on('evolution:progress', listener);
    return () => ipcRenderer.removeListener('evolution:progress', listener);
  },
  onEvolutionStatus: (callback: (data: any) => void) => {
    const listener = (_: any, data: any) => callback(data);
    ipcRenderer.on('evolution:status', listener);
    return () => ipcRenderer.removeListener('evolution:status', listener);
  },
  onEvolutionComplete: (callback: (data: any) => void) => {
    const listener = (_: any, data: any) => callback(data);
    ipcRenderer.on('evolution:complete', listener);
    return () => ipcRenderer.removeListener('evolution:complete', listener);
  },
  onEvolutionError: (callback: (data: any) => void) => {
    const listener = (_: any, data: any) => callback(data);
    ipcRenderer.on('evolution:error', listener);
    return () => ipcRenderer.removeListener('evolution:error', listener);
  },

  // Configuration
  getConfig: (configPath?: string) => ipcRenderer.invoke('config:get', configPath),
  saveConfig: (configPath: string, config: any) => ipcRenderer.invoke('config:save', configPath, config),

  // Dialog APIs
  openFileDialog: (options?: { filters?: { name: string; extensions: string[] }[] }) =>
    ipcRenderer.invoke('dialog:openFile', options),
  openDirectoryDialog: () => ipcRenderer.invoke('dialog:openDirectory'),
  saveFileDialog: (options?: { filters?: { name: string; extensions: string[] }[]; defaultPath?: string }) =>
    ipcRenderer.invoke('dialog:saveFile', options),
  showMessageBox: (options: {
    type?: 'info' | 'warning' | 'error' | 'question';
    title: string;
    message: string;
    buttons?: string[];
  }) => ipcRenderer.invoke('dialog:showMessage', options),

  // File system APIs
  readFile: (filePath: string) => ipcRenderer.invoke('fs:readFile', filePath),
  writeFile: (filePath: string, content: string) => ipcRenderer.invoke('fs:writeFile', filePath, content),
  getTempDir: () => ipcRenderer.invoke('fs:getTempDir'),

  // Menu event listeners
  onMenuOpenProject: (callback: () => void) => {
    ipcRenderer.on('menu:openProject', callback);
    return () => ipcRenderer.removeListener('menu:openProject', callback);
  },
  onMenuPreferences: (callback: () => void) => {
    ipcRenderer.on('menu:preferences', callback);
    return () => ipcRenderer.removeListener('menu:preferences', callback);
  },
  onMenuStartEvolution: (callback: () => void) => {
    ipcRenderer.on('menu:startEvolution', callback);
    return () => ipcRenderer.removeListener('menu:startEvolution', callback);
  },
  onMenuStopEvolution: (callback: () => void) => {
    ipcRenderer.on('menu:stopEvolution', callback);
    return () => ipcRenderer.removeListener('menu:stopEvolution', callback);
  },
});

// Type definitions for TypeScript
export interface ElectronAPI {
  // Evolution
  startEvolution: (options: any) => Promise<{ runId: string; status: string }>;
  stopEvolution: (runId: string) => Promise<{ status: string }>;
  getEvolutionStatus: (runId: string) => Promise<any>;
  onEvolutionProgress: (callback: (data: any) => void) => () => void;
  onEvolutionStatus: (callback: (data: any) => void) => () => void;
  onEvolutionComplete: (callback: (data: any) => void) => () => void;
  onEvolutionError: (callback: (data: any) => void) => () => void;
  
  // Config
  getConfig: (configPath?: string) => Promise<any>;
  saveConfig: (configPath: string, config: any) => Promise<{ success: boolean }>;
  
  // Dialog
  openFileDialog: (options?: { filters?: { name: string; extensions: string[] }[] }) => Promise<string | null>;
  openDirectoryDialog: () => Promise<string | null>;
  saveFileDialog: (options?: { filters?: { name: string; extensions: string[] }[]; defaultPath?: string }) => Promise<string | null>;
  showMessageBox: (options: {
    type?: 'info' | 'warning' | 'error' | 'question';
    title: string;
    message: string;
    buttons?: string[];
  }) => Promise<number>;
  
  // File system
  readFile: (filePath: string) => Promise<string>;
  writeFile: (filePath: string, content: string) => Promise<boolean>;
  getTempDir: () => Promise<string>;
  
  // Menu
  onMenuOpenProject: (callback: () => void) => () => void;
  onMenuPreferences: (callback: () => void) => () => void;
  onMenuStartEvolution: (callback: () => void) => () => void;
  onMenuStopEvolution: (callback: () => void) => () => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
