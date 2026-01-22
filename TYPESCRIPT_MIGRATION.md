# TypeScript Backend Migration Guide

This document describes the migration from Python backend (FastAPI) to native TypeScript backend running in the Electron main process.

## Overview

The OpenEvolve desktop application has been migrated to use a native TypeScript backend integrated with PACEvolve algorithm improvements from the research paper "PACEvolve: Enabling Long-Horizon Progress-Aware Consistent Evolution" (arXiv:2601.10657v2).

## Architecture Changes

### Before (Python Backend)
```
Electron App
├── Renderer Process (React UI)
│   └── HTTP/WebSocket → Python FastAPI Server
└── Main Process
    └── Spawns Python subprocess
```

### After (TypeScript Backend)
```
Electron App
├── Renderer Process (React UI)
│   └── IPC → Main Process
└── Main Process (Node.js)
    ├── EvolutionEngine
    ├── ProgramDatabase
    ├── Evaluator
    ├── LLMEnsemble
    └── PACEvolve Components
```

## New Features (PACEvolve Algorithm)

### 1. Hierarchical Context Management (HCM)
- Decouples idea generation from selection
- Maintains hierarchical "idea memory" structure
- Prunes stale ideas to reduce context pollution
- Improves long-horizon evolution consistency

### 2. Momentum-Based Backtracking (MBB)
- Tracks improvement momentum over recent iterations
- Detects stagnation via momentum thresholds
- Backtracks to previous promising states when stuck
- Escapes local minima more effectively

### 3. Self-Adaptive Collaborative Evolution (CE)
- Coordinates parallel search across islands
- Dynamic crossover between search trajectories
- Adaptive sampling policy adjusts explore/exploit/backtrack probabilities
- Better long-term progress than static strategies

## Breaking Changes

### Evaluators Must Be TypeScript

**Before (Python):**
```python
def evaluate(program_path: str) -> dict[str, float]:
    # Load and test program
    return {"accuracy": 0.95, "combined_score": 0.95}
```

**After (TypeScript):**
```typescript
export async function evaluate(programPath: string): Promise<Record<string, number>> {
  // Load and test program
  return { accuracy: 0.95, combined_score: 0.95 };
}
```

### No HTTP API

The FastAPI server has been removed. All communication happens via Electron IPC.

**Before:**
```typescript
fetch('http://localhost:8765/api/evolution/start', { method: 'POST', ... })
```

**After:**
```typescript
window.electronAPI.startEvolution({ ... })
```

### Configuration Format

Configuration files remain YAML but internal representation uses camelCase for nested properties:

```yaml
# YAML (unchanged)
max_iterations: 1000
database:
  num_islands: 5
  
pacevolve:  # NEW
  enable_hcm: true
  enable_mbb: true
  enable_ce: true
```

## Migration Checklist

### For End Users

- [ ] Rewrite Python evaluators in TypeScript/JavaScript
- [ ] Update configuration files to include PACEvolve settings
- [ ] Test evaluators work with TypeScript engine
- [ ] Run `npm install` in desktop directory

### For Developers

- [ ] Remove Python backend dependencies from build process
- [ ] Update renderer to use IPC instead of HTTP
- [ ] Test IPC communication flow
- [ ] Update documentation and examples

## PACEvolve Configuration

New configuration options in the `pacevolve` section:

```yaml
pacevolve:
  # Hierarchical Context Management
  enable_hcm: true
  idea_memory_size: 50
  pruning_threshold: 0.3
  pruning_interval: 10
  
  # Momentum-Based Backtracking
  enable_mbb: true
  momentum_window_size: 10
  stagnation_threshold: 0.001
  backtrack_depth: 5
  
  # Self-Adaptive Collaborative Evolution
  enable_ce: true
  initial_explore_prob: 0.3
  initial_exploit_prob: 0.5
  initial_backtrack_prob: 0.2
  adaptation_rate: 0.1
  crossover_frequency: 20
```

## Performance Improvements

1. **No subprocess overhead** - Engine runs in same Node.js process
2. **Faster IPC** - Direct IPC communication vs HTTP/WebSocket
3. **Better parallelism** - Native Worker threads vs Python multiprocessing
4. **PACEvolve benefits** - Improved long-horizon consistency and convergence

## Example Migration

### Before: Python Evaluator

```python
# evaluator.py
import sys

def evaluate(program_path: str) -> dict:
    with open(program_path) as f:
        code = f.read()
    
    # Execute program
    exec(code)
    
    # Test and return metrics
    return {
        "accuracy": test_accuracy(),
        "combined_score": test_accuracy()
    }
```

### After: TypeScript Evaluator

```typescript
// evaluator.ts
import * as fs from 'fs';

export async function evaluate(programPath: string): Promise<Record<string, number>> {
  const code = fs.readFileSync(programPath, 'utf8');
  
  // Dynamically import and run the program
  const module = await import(programPath);
  
  // Test and return metrics
  const accuracy = await testAccuracy(module);
  
  return {
    accuracy,
    combined_score: accuracy,
  };
}
```

## Troubleshooting

### Issue: "Cannot find module" errors

**Solution:** Ensure evaluator path is absolute and file has `.js` or `.ts` extension

### Issue: Evolution not starting

**Solution:** Check console logs in Electron DevTools (View → Toggle Developer Tools)

### Issue: Evaluator timing out

**Solution:** Increase `evaluator.timeout` in configuration

## Resources

- PACEvolve Paper: https://arxiv.org/abs/2601.10657v2
- Engine README: `desktop/src/main/engine/README.md`
- Example Evaluators: `examples/` directory (needs TypeScript conversion)
