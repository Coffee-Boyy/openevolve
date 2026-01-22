# OpenEvolve TypeScript Engine

Native TypeScript implementation of the OpenEvolve evolution engine with PACEvolve algorithm improvements.

## Architecture

The engine runs directly in the Electron main process and communicates with the renderer via IPC.

### Core Components

- **EvolutionEngine** (`controller.ts`) - Main orchestrator that coordinates all components
- **ProgramDatabase** (`database.ts`) - Stores programs with MAP-Elites and island-based evolution
- **Evaluator** (`evaluator.ts`) - Evaluates program performance using user-provided evaluators
- **LLMEnsemble** (`llm/`) - Manages weighted ensemble of LLM models
- **PromptSampler** (`prompt/`) - Generates prompts for code evolution

### PACEvolve Components

The engine implements three key components from the PACEvolve paper (arXiv:2601.10657v2):

1. **Hierarchical Context Management (HCM)** (`pacevolve/context-manager.ts`)
   - Decouples idea generation from selection
   - Maintains hierarchical "idea memory" with pruning
   - Reduces context pollution over long evolution runs

2. **Momentum-Based Backtracking (MBB)** (`pacevolve/backtracking.ts`)
   - Tracks improvement momentum over recent iterations
   - Detects stagnation and local minima
   - Backtracks to previous promising states when stuck

3. **Self-Adaptive Collaborative Evolution (CE)** (`pacevolve/collaborative.ts`)
   - Coordinates parallel search across islands
   - Dynamic crossover between trajectories
   - Adaptive sampling policy (explore/exploit/backtrack)

## Configuration

Configuration is loaded from YAML files with the following structure:

```yaml
max_iterations: 10000
checkpoint_interval: 100
language: typescript
file_suffix: .ts

llm:
  models:
    - name: gpt-4o-mini
      weight: 0.8
    - name: o1-mini
      weight: 0.2
  temperature: 0.7
  max_tokens: 4096

database:
  population_size: 1000
  num_islands: 5
  feature_dimensions: [complexity, diversity]
  migration_interval: 50

evaluator:
  timeout: 300
  cascade_evaluation: true
  parallel_evaluations: 4

pacevolve:
  enable_hcm: true
  enable_mbb: true
  enable_ce: true
  momentum_window_size: 10
  crossover_frequency: 20
```

## Writing Evaluators

Evaluators are TypeScript/JavaScript modules that export evaluation functions:

```typescript
// evaluator.ts
export async function evaluate(programPath: string): Promise<Record<string, number>> {
  // Load and run the program
  const program = await import(programPath);
  
  // Test the program
  const results = await runTests(program);
  
  // Return metrics
  return {
    accuracy: results.accuracy,
    speed: results.speed,
    combined_score: results.accuracy * 0.7 + results.speed * 0.3,
  };
}

// Optional: Cascade evaluation for progressive filtering
export async function evaluate_stage1(programPath: string): Promise<Record<string, number>> {
  // Fast, basic checks
  return { basic_tests: 0.8 };
}

export async function evaluate_stage2(programPath: string): Promise<Record<string, number>> {
  // More comprehensive checks
  return { advanced_tests: 0.9 };
}
```

## IPC Communication

The engine communicates with the renderer process via Electron IPC:

### Main Process Channels

```typescript
// Start evolution
ipcMain.handle('evolution:start', async (_, options) => { ... });

// Stop evolution
ipcMain.handle('evolution:stop', async (_, runId) => { ... });

// Get status
ipcMain.handle('evolution:getStatus', async (_, runId) => { ... });
```

### Renderer Events

```typescript
// Progress updates
mainWindow.webContents.send('evolution:progress', data);

// Status changes
mainWindow.webContents.send('evolution:status', status);

// Completion
mainWindow.webContents.send('evolution:complete', result);
```

## Key Features

1. **IPC Communication** - Direct communication between main and renderer processes
2. **TypeScript/JavaScript Evaluators** - Native JavaScript ecosystem support
3. **Native Performance** - Runs in same process, no subprocess overhead
4. **PACEvolve Algorithm** - Includes HCM, MBB, and CE improvements
5. **Island-Based Evolution** - Parallel search with adaptive collaboration

## Development

To build and run:

```bash
cd desktop
pnpm install
pnpm run dev
```

To build for production:

```bash
pnpm run build
pnpm run build:mac    # macOS
pnpm run build:win    # Windows
pnpm run build:linux  # Linux
```
