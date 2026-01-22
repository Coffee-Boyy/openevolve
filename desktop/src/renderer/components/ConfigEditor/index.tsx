import { useEffect, useState } from 'react';
import Editor from '@monaco-editor/react';
import { useAppStore } from '../../store/appStore';
import * as yaml from 'js-yaml';

export default function ConfigEditor() {
  const { apiClient, theme } = useAppStore();
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
      // Parse YAML to validate
      const configObj = yaml.load(config);
      
      if (typeof configObj !== 'object' || configObj === null) {
        throw new Error('Invalid configuration format');
      }

      // Update configuration
      await apiClient.updateConfig(configObj as any);
      setOriginalConfig(config);
      setIsDirty(false);
    } catch (err: any) {
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

      // Load config from file via API
      if (apiClient) {
        const configData = await apiClient.getConfig();
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
        defaultPath: 'config.yaml',
      });

      if (!path) return;

      // In a real implementation, we'd save via the API
      // For now, just show a success message
      console.log('Would save to:', path);
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
