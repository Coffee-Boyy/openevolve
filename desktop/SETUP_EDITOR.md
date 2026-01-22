# Setup Editor Documentation

The Setup tab provides full-screen code editors for configuring the initial program and evaluation function before starting an evolution run.

## Overview

The Setup view is the first tab in the OpenEvolve desktop application, designed to help users:
1. Write or load the initial program that will be evolved
2. Write or load the evaluation function that scores generated programs
3. Easily switch between editing both files with full-screen editors
4. Save and load programs from disk

## Features

### Tab-Based Interface

Instead of split panes, the Setup view uses tabs to provide full-screen editing:

- **Initial Program Tab**: Edit the starting program
- **Evaluation Function Tab**: Edit the scoring function
- **Quick switching**: Click tabs to toggle between editors
- **Visual indicators**: Orange dots show which files have unsaved changes
- **Line counts**: Header shows line count for each file

### Full-Screen Monaco Editor

Each editor provides:
- **Syntax highlighting** for TypeScript/JavaScript
- **Auto-completion** and IntelliSense
- **Line numbers** and code folding
- **Minimap** for navigation
- **Word wrap** enabled by default
- **Theme-aware** (adapts to light/dark mode)
- **Real-time editing** with instant feedback

### Template System

Built-in templates help you get started:

#### Initial Program Template
```typescript
/**
 * Initial program template.
 * This is the starting point for evolution.
 */

export function solve(): any {
  // Your solution here
  return null;
}

// Test the solution
if (require.main === module) {
  const result = solve();
  console.log(result);
}
```

#### Evaluator Template
```typescript
"""
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
        result = subprocess.run(
            [sys.executable, "-c", program_content],
            capture_output=True,
            text=True,
            timeout=5
        )
        
        score = 0.0
        
        if result.returncode == 0:
            score += 0.5  # Program runs successfully
            
            # Add your evaluation logic here
            output = result.stdout.strip()
        
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
```

### Action Buttons

Each editor provides several action buttons:

#### Load Template
- Loads the default template for that file type
- Useful for starting from scratch
- Shows unsaved changes indicator

#### Load from File
- Opens file dialog to select a `.ts`, `.js`, or other file
- Reads file content into the editor
- Supports TypeScript, JavaScript, and other text files

#### Save to File
- Opens save dialog to choose destination
- Saves current editor content to disk
- Default filenames: `initial_program.ts` or `evaluator.ts`
- Shows success/error notifications

#### Reset (when changes exist)
- Reverts to last applied version
- Discards unsaved changes
- Only visible when there are unsaved changes

#### Apply Changes (when changes exist)
- Saves changes to app state
- Makes code available for evolution runs
- Only visible when there are unsaved changes
- Updates localStorage for persistence

### Change Tracking

The editor tracks changes and provides visual feedback:

- **Unsaved changes badge**: Shows at top of editor when content differs from saved version
- **Orange dot indicator**: Appears on tab when file has unsaved changes
- **Apply/Reset buttons**: Only appear when changes exist
- **Automatic persistence**: Applied changes are saved to localStorage

### File Statistics

The footer of each editor shows:
- **Line count**: Total lines in the file
- **Character count**: Total characters
- **Language**: Always shows "TypeScript"

### Integration with Evolution

When starting an evolution run:

1. **Validation**: System checks if both files are configured
2. **Temporary files**: Code is written to temporary `.ts` files
3. **File paths**: Paths are passed to the evolution backend
4. **Warning dialog**: Shows if files are missing

## Usage Flow

### Typical Workflow

1. **Open Setup Tab**
   - Default view when app starts
   - Or click "Setup" in the main navigation

2. **Write Initial Program**
   - Click "Initial Program" tab
   - Load template or write from scratch
   - Click "Apply Changes" when done

3. **Write Evaluator**
   - Click "Evaluation Function" tab
   - Load template or customize evaluation logic
   - Click "Apply Changes" when done

4. **Start Evolution**
   - Go to status panel on the left
   - Click "Start Evolution"
   - System validates and starts the run

### Advanced Workflows

#### Loading Existing Projects

1. Click "Load from File" on each tab
2. Select your existing TypeScript/JavaScript files
3. Review and edit as needed
4. Apply changes to save

#### Saving Work

1. Make changes in either editor
2. Click "Save to File" to persist to disk
3. Choose location and filename
4. Files are saved for later use

#### Template-Based Start

1. Click "Load Template" to start fresh
2. Customize the template code
3. Add your specific logic
4. Apply changes when ready

## Keyboard Shortcuts

### Monaco Editor (built-in)
- `Ctrl/Cmd + F`: Find
- `Ctrl/Cmd + H`: Find and replace
- `Ctrl/Cmd + /`: Toggle comment
- `Ctrl/Cmd + ]`: Indent
- `Ctrl/Cmd + [`: Outdent
- `Ctrl/Cmd + S`: Save (triggers Apply Changes)
- `Alt + Up/Down`: Move line up/down
- `Ctrl/Cmd + D`: Select next occurrence

### Tab Navigation
- Click tab headers to switch
- Visual feedback on hover

## Persistence

### LocalStorage
- Applied changes are automatically saved to localStorage
- Survives app restarts
- Keys used:
  - `setupCode_initial`: Initial program content
  - `setupCode_evaluator`: Evaluator content

### File System
- Use "Save to File" for permanent storage
- Load files back with "Load from File"
- Files can be shared or version controlled

## Best Practices

### Initial Program

1. **Keep it simple**: Start with a basic working solution
2. **Add comments**: Help the LLM understand intent
3. **Test it**: Run the program independently first
4. **Use clear structure**: Functions, classes, etc.

### Evaluator Function

1. **Fast execution**: Keep evaluation quick (<5 seconds)
2. **Multiple metrics**: Return several scores for better evolution
3. **Handle errors**: Catch and score failures gracefully
4. **Clear scoring**: Higher is better (consistent scale)
5. **Test thoroughly**: Verify it scores correctly

### Code Organization

1. **Save frequently**: Use "Save to File" to backup work
2. **Version control**: Keep copies of working configurations
3. **Document changes**: Add comments explaining modifications
4. **Test together**: Verify initial program and evaluator work together

## Common Patterns

### Circle Packing Example

**Initial Program:**
```python
import random

def pack_circles(radius=1.0, num_circles=10):
    """Pack circles in a square"""
    circles = []
    for _ in range(num_circles):
        x = random.uniform(0, 10)
        y = random.uniform(0, 10)
        circles.append((x, y, radius))
    return circles

if __name__ == "__main__":
    result = pack_circles()
    print(result)
```

**Evaluator:**
```python
import subprocess
import sys
import ast

def evaluate(program_content: str) -> Dict[str, float]:
    result = subprocess.run(
        [sys.executable, "-c", program_content],
        capture_output=True,
        text=True,
        timeout=5
    )
    
    if result.returncode != 0:
        return {"combined_score": 0.0}
    
    try:
        circles = ast.literal_eval(result.stdout.strip())
        # Score based on non-overlapping circles
        overlaps = count_overlaps(circles)
        score = max(0, 1.0 - overlaps * 0.1)
        
        return {
            "combined_score": score,
            "num_circles": float(len(circles)),
            "overlap_penalty": float(overlaps)
        }
    except:
        return {"combined_score": 0.0}
```

## Troubleshooting

### Changes Not Saving
- **Symptom**: Changes disappear after restart
- **Solution**: Click "Apply Changes" before closing
- **Note**: Unsaved changes are not persisted

### Template Won't Load
- **Symptom**: Template button doesn't work
- **Solution**: Refresh the page or restart app
- **Workaround**: Copy template from documentation

### File Won't Save
- **Symptom**: Save dialog fails
- **Solution**: Check file permissions on target directory
- **Try**: Save to a different location

### Evolution Won't Start
- **Symptom**: Warning about missing setup code
- **Solution**: Apply changes in both tabs first
- **Check**: Ensure both files have content

## Technical Details

### Component Structure
```
SetupView
├── Tabs.Root (Radix UI)
│   ├── Tabs.List (Tab headers)
│   │   ├── Initial Program tab
│   │   ├── Evaluation Function tab
│   │   └── Stats display
│   ├── Tabs.Content[initial]
│   │   └── ProgramEditor (type="initial")
│   └── Tabs.Content[evaluator]
│       └── ProgramEditor (type="evaluator")
```

### State Management
- **Global state**: Zustand store (`useAppStore`)
- **Local state**: Tab selection, change tracking
- **Persistence**: localStorage for applied changes

### File I/O
- **Read**: IPC call to `fs:readFile`
- **Write**: IPC call to `fs:writeFile`
- **Security**: Sandboxed through Electron contextBridge

## Future Enhancements

Potential improvements:

1. **Split-pane option**: Toggle between tabs and split view
2. **Diff viewer**: Compare changes before applying
3. **Code snippets**: Library of reusable patterns
4. **Syntax validation**: Real-time TypeScript syntax checking
5. **Test runner**: Run code directly from editor
6. **History**: Undo/redo across sessions
7. **Templates library**: More starter templates
8. **Import from examples**: Load from examples folder

## Related Documentation

- [Evolution Viewer](./EVOLUTION_VIEWER.md): View results
- [Engine README](./src/main/engine/README.md): TypeScript backend integration
- [Main README](./README.md): Overall app documentation
