# OpenEvolve Desktop - Quick Start with TypeScript Backend

## Installation

```bash
cd desktop
pnpm install
```

## Development

```bash
pnpm run dev
```

This will start:
- Vite dev server for the React UI
- Electron app with hot reload
- Native TypeScript evolution engine

## Building

```bash
# Build for current platform
pnpm run build

# Platform-specific builds
pnpm run build:mac
pnpm run build:win
pnpm run build:linux
```

## Creating an Evaluator

Create a TypeScript evaluator file:

```typescript
// my-evaluator.ts
export async function evaluate(programPath: string): Promise<Record<string, number>> {
  const fs = require('fs');
  const code = fs.readFileSync(programPath, 'utf8');
  
  // Your evaluation logic here
  const accuracy = testProgram(code);
  
  return {
    accuracy,
    combined_score: accuracy, // Required for evolution guidance
  };
}

function testProgram(code: string): number {
  // Your test logic
  return 0.95;
}
```

## Running Evolution

1. Launch the desktop app
2. Click "Setup" tab
3. Select your initial program file
4. Select your evaluator file
5. Configure settings (optional)
6. Click "Start Evolution"

## Configuration

Create a YAML config file:

```yaml
max_iterations: 1000
language: typescript
file_suffix: .ts

llm:
  models:
    - name: gpt-4o-mini
      weight: 1.0

database:
  population_size: 500
  num_islands: 3

pacevolve:
  enable_hcm: true
  enable_mbb: true
  enable_ce: true
```

## PACEvolve Features

The TypeScript backend includes PACEvolve algorithm improvements:

### Hierarchical Context Management (HCM)
- Reduces context pollution in long evolution runs
- Separates idea generation from selection
- Automatic pruning of stale ideas

### Momentum-Based Backtracking (MBB)
- Detects stagnation via momentum tracking
- Backtracks to promising states when stuck
- Escapes local minima effectively

### Self-Adaptive Collaborative Evolution (CE)
- Dynamic explore/exploit/backtrack strategy
- Crossover between island populations
- Adapts to evolution progress

## Troubleshooting

### Module not found errors
Ensure evaluator has proper imports and exports

### Evolution not starting
Check Electron DevTools console (View → Toggle Developer Tools)

### Performance issues
Increase `evaluator.parallel_evaluations` in config

## Examples

See `examples/typescript/` for TypeScript evaluator examples.

## Resources

- [Engine README](src/main/engine/README.md)
- [Migration Guide](../TYPESCRIPT_MIGRATION.md)
- [PACEvolve Paper](https://arxiv.org/abs/2601.10657v2)
