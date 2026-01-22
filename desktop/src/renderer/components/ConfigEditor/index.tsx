import { useEffect, useState } from 'react';
import Editor from '@monaco-editor/react';
import { useAppStore } from '../../store/appStore';
import * as yaml from 'js-yaml';

export default function ConfigEditor() {
  const { apiClient, theme, configPath, setConfigPath } = useAppStore();
  const [config, setConfig] = useState<string>('');
  const [originalConfig, setOriginalConfig] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    loadConfig();
  }, [apiClient]);

  const loadConfig = async () => {
    if (!apiClient) return;

    setLoading(true);
    setError(null);

    try {
      const configData = await apiClient.getConfig();
      const yamlStr = yaml.dump(configData, { indent: 2 });
      setConfig(yamlStr);
      setOriginalConfig(yamlStr);
      setIsDirty(false);
    } catch (err: any) {
      setError(err.message || 'Failed to load configuration');
      console.error('Failed to load config:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!apiClient) return;

    setLoading(true);
    setError(null);

    try {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/0967f0db-dd0f-4f07-b0e8-2fd7aeec4c88',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ConfigEditor/index.tsx:46',message:'handleSave called',data:{hasApiClient:!!apiClient,configLength:config.length,configPath:configPath},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      
      // Parse YAML to validate
      const configObj = yaml.load(config);
      
      if (typeof configObj !== 'object' || configObj === null) {
        throw new Error('Invalid configuration format');
      }

      // If no config path, prompt user to select one
      let savePath = configPath;
      if (!savePath) {
        savePath = await window.electronAPI.saveFileDialog({
          filters: [{ name: 'YAML Files', extensions: ['yaml', 'yml'] }],
          defaultPath: 'config.yaml',
        });

        if (!savePath) {
          setLoading(false);
          return; // User cancelled
        }

        // Save the path for future saves
        setConfigPath(savePath);
      }

      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/0967f0db-dd0f-4f07-b0e8-2fd7aeec4c88',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ConfigEditor/index.tsx:73',message:'Before updateConfig call',data:{configObjKeys:Object.keys(configObj),savePath:savePath,hasConfigPath:!!savePath},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'A,C'})}).catch(()=>{});
      // #endregion

      // Update configuration
      await apiClient.updateConfig(configObj as any, savePath);
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/0967f0db-dd0f-4f07-b0e8-2fd7aeec4c88',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ConfigEditor/index.tsx:79',message:'After updateConfig call - success',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      
      setOriginalConfig(config);
      setIsDirty(false);
    } catch (err: any) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/0967f0db-dd0f-4f07-b0e8-2fd7aeec4c88',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ConfigEditor/index.tsx:87',message:'updateConfig failed',data:{errorMessage:err.message,errorStack:err.stack},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'A,D'})}).catch(()=>{});
      // #endregion
      
      setError(err.message || 'Failed to save configuration');
      console.error('Failed to save config:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setConfig(originalConfig);
    setIsDirty(false);
    setError(null);
  };

  const handleLoadFile = async () => {
    try {
      const path = await window.electronAPI.openFileDialog({
        filters: [{ name: 'YAML Files', extensions: ['yaml', 'yml'] }],
      });

      if (!path) return;

      // Save the config path for future saves
      setConfigPath(path);

      // Load config from file via API
      if (apiClient) {
        const configData = await apiClient.getConfig(path);
        const yamlStr = yaml.dump(configData, { indent: 2 });
        setConfig(yamlStr);
        setOriginalConfig(yamlStr);
        setIsDirty(false);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load config file');
    }
  };

  const handleSaveFile = async () => {
    try {
      const path = await window.electronAPI.saveFileDialog({
        filters: [{ name: 'YAML Files', extensions: ['yaml', 'yml'] }],
        defaultPath: configPath || 'config.yaml',
      });

      if (!path) return;

      // Save the config path for future saves
      setConfigPath(path);

      // Parse and save via API
      const configObj = yaml.load(config);
      if (typeof configObj !== 'object' || configObj === null) {
        throw new Error('Invalid configuration format');
      }

      if (apiClient) {
        await apiClient.updateConfig(configObj as any, path);
        setOriginalConfig(config);
        setIsDirty(false);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to save config file');
    }
  };

  const handleEditorChange = (value: string | undefined) => {
    if (value !== undefined) {
      setConfig(value);
      setIsDirty(value !== originalConfig);
      setError(null);
    }
  };

  if (loading && !config) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground">
        <p>Loading configuration...</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="border-b border-border px-4 py-2 flex items-center justify-between bg-secondary/30">
        <div className="flex items-center space-x-2">
          <span className="text-sm font-medium">Configuration Editor</span>
          {isDirty && (
            <span className="text-xs text-muted-foreground">(unsaved changes)</span>
          )}
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={handleLoadFile}
            className="px-3 py-1 text-sm border border-border rounded hover:bg-accent"
            disabled={loading}
          >
            Load File
          </button>
          <button
            onClick={handleSaveFile}
            className="px-3 py-1 text-sm border border-border rounded hover:bg-accent"
            disabled={loading}
          >
            Save File
          </button>
          <button
            onClick={handleReset}
            className="px-3 py-1 text-sm border border-border rounded hover:bg-accent"
            disabled={!isDirty || loading}
          >
            Reset
          </button>
          <button
            onClick={handleSave}
            className="px-3 py-1 text-sm bg-primary text-primary-foreground rounded hover:bg-primary/90"
            disabled={!isDirty || loading}
          >
            {loading ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      {error && (
        <div className="mx-4 mt-2 p-2 bg-destructive/10 border border-destructive rounded text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="flex-1 overflow-hidden">
        <Editor
          height="100%"
          defaultLanguage="yaml"
          value={config}
          onChange={handleEditorChange}
          theme={theme === 'dark' ? 'vs-dark' : 'light'}
          options={{
            minimap: { enabled: false },
            fontSize: 13,
            lineNumbers: 'on',
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 2,
          }}
        />
      </div>
    </div>
  );
}
