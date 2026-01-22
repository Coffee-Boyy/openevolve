import { useState, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import { useAppStore } from '../../store/appStore';

export type ProgramType = 'initial' | 'evaluator';

interface ProgramEditorProps {
  type: ProgramType;
  value: string;
  onChange: (value: string) => void;
  onLoad?: () => void;
  onSave?: () => void;
}

const TEMPLATES = {
  initial: `"""
Initial program template.
This is the starting point for evolution.
"""

def solve():
    """Your solution here"""
    pass


if __name__ == "__main__":
    result = solve()
    print(result)
`,
  evaluator: `"""
Evaluation function template.
This function evaluates the quality of generated programs.
"""

import subprocess
import sys
from typing import Dict


def evaluate(program_content: str) -> Dict[str, float]:
    """
    Evaluate the given program.
    
    Args:
        program_content: The source code of the program to evaluate
        
    Returns:
        Dictionary with metric name -> score mappings.
        Higher scores are better.
    """
    
    # Example: Run the program and evaluate its output
    try:
        # Execute the program
        result = subprocess.run(
            [sys.executable, "-c", program_content],
            capture_output=True,
            text=True,
            timeout=5
        )
        
        # Calculate metrics based on output
        score = 0.0
        
        if result.returncode == 0:
            score += 0.5  # Program runs successfully
            
            # Add your evaluation logic here
            # For example, check output, performance, correctness, etc.
            output = result.stdout.strip()
            # score += evaluate_output(output)
        
        return {
            "combined_score": score,
            "success": float(result.returncode == 0),
        }
        
    except subprocess.TimeoutExpired:
        return {
            "combined_score": 0.0,
            "success": 0.0,
            "error": "timeout"
        }
    except Exception as e:
        return {
            "combined_score": 0.0,
            "success": 0.0,
            "error": str(e)
        }


if __name__ == "__main__":
    # Test the evaluator
    test_program = '''
print("Hello, World!")
'''
    
    metrics = evaluate(test_program)
    print(f"Metrics: {metrics}")
`,
};

export default function ProgramEditor({
  type,
  value,
  onChange,
  onLoad,
  onSave,
}: ProgramEditorProps) {
  const { theme } = useAppStore();
  const [localValue, setLocalValue] = useState(value);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    setLocalValue(value);
    setHasChanges(false);
  }, [value]);

  const handleChange = (newValue: string | undefined) => {
    if (newValue !== undefined) {
      setLocalValue(newValue);
      setHasChanges(newValue !== value);
    }
  };

  const handleApply = () => {
    onChange(localValue);
    setHasChanges(false);
  };

  const handleReset = () => {
    setLocalValue(value);
    setHasChanges(false);
  };

  const handleLoadTemplate = () => {
    const template = TEMPLATES[type];
    setLocalValue(template);
    setHasChanges(template !== value);
  };

  const handleLoadFromFile = async () => {
    try {
      const filePath = await window.electronAPI.openFileDialog({
        filters: [
          { name: 'TypeScript Files', extensions: ['ts'] },
          { name: 'JavaScript Files', extensions: ['js'] },
          { name: 'All Files', extensions: ['*'] }
        ],
      });

      if (filePath) {
        const content = await window.electronAPI.readFile(filePath);
        setLocalValue(content);
        setHasChanges(content !== value);
        onLoad?.();
      }
    } catch (error) {
      console.error('Failed to load file:', error);
      await window.electronAPI.showMessageBox({
        type: 'error',
        title: 'Load Failed',
        message: error instanceof Error ? error.message : 'Failed to load file',
      });
    }
  };

  const handleSaveToFile = async () => {
    try {
      const filePath = await window.electronAPI.saveFileDialog({
        filters: [
          { name: 'TypeScript Files', extensions: ['ts'] },
          { name: 'JavaScript Files', extensions: ['js'] },
          { name: 'All Files', extensions: ['*'] }
        ],
        defaultPath: type === 'initial' ? 'initial_program.ts' : 'evaluator.ts',
      });

      if (filePath) {
        await window.electronAPI.writeFile(filePath, localValue);
        await window.electronAPI.showMessageBox({
          type: 'info',
          title: 'Save Successful',
          message: `File saved to ${filePath}`,
        });
        onSave?.();
      }
    } catch (error) {
      console.error('Failed to save file:', error);
      await window.electronAPI.showMessageBox({
        type: 'error',
        title: 'Save Failed',
        message: error instanceof Error ? error.message : 'Failed to save file',
      });
    }
  };

  const title = type === 'initial' ? 'Initial Program' : 'Evaluation Function';
  const description =
    type === 'initial'
      ? 'The starting program that will be evolved'
      : 'Function that evaluates the quality of generated programs';

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="border-b border-border p-4 bg-muted/30">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h3 className="text-lg font-semibold">{title}</h3>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
          {hasChanges && (
            <span className="text-xs px-2 py-1 bg-orange-500/10 text-orange-600 dark:text-orange-400 rounded-full">
              Unsaved changes
            </span>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 mt-3">
          <button
            onClick={handleLoadTemplate}
            className="px-3 py-1.5 text-xs bg-secondary hover:bg-secondary/80 rounded-md transition-colors"
          >
            Load Template
          </button>
          <button
            onClick={handleLoadFromFile}
            className="px-3 py-1.5 text-xs bg-secondary hover:bg-secondary/80 rounded-md transition-colors"
          >
            Load from File
          </button>
          <button
            onClick={handleSaveToFile}
            className="px-3 py-1.5 text-xs bg-secondary hover:bg-secondary/80 rounded-md transition-colors"
            disabled={!localValue.trim()}
          >
            Save to File
          </button>
          <div className="flex-1" />
          {hasChanges && (
            <>
              <button
                onClick={handleReset}
                className="px-3 py-1.5 text-xs bg-secondary hover:bg-secondary/80 rounded-md transition-colors"
              >
                Reset
              </button>
              <button
                onClick={handleApply}
                className="px-3 py-1.5 text-xs bg-primary text-primary-foreground hover:bg-primary/90 rounded-md transition-colors"
              >
                Apply Changes
              </button>
            </>
          )}
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 overflow-hidden">
        <Editor
          height="100%"
          defaultLanguage="typescript"
          value={localValue}
          onChange={handleChange}
          theme={theme === 'dark' ? 'vs-dark' : 'light'}
          options={{
            minimap: { enabled: true },
            fontSize: 13,
            lineNumbers: 'on',
            scrollBeyondLastLine: false,
            automaticLayout: true,
            wordWrap: 'on',
            tabSize: 4,
            insertSpaces: true,
          }}
        />
      </div>

      {/* Footer with stats */}
      <div className="border-t border-border px-4 py-2 text-xs text-muted-foreground bg-muted/30">
        <div className="flex justify-between">
          <span>
            Lines: {localValue.split('\n').length} | Characters: {localValue.length}
          </span>
          <span>TypeScript</span>
        </div>
      </div>
    </div>
  );
}
