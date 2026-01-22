# Checkpoint Data Path Fix

## Problem
The system was continuously looking for checkpoint data in the `examples/` directory, but evolution runs were saving data to temporary directories (e.g., `/var/folders/.../openevolve/run-*/openevolve_output/`). This caused:
- Logs showing "No checkpoint folders found in examples/"
- Empty Evolution tab (no graph data)
- Empty program details when clicking nodes

## Root Cause
The `/api/data` endpoint defaulted to searching in `examples/` or `EVOLVE_OUTPUT` environment variable, but evolution runs created by the UI were using temporary directories that weren't being tracked.

## Solution

### 1. Store Output Directory in Active Runs
**File: `openevolve/server_api/routes/evolution.py`**
- Added `output_dir` to the `active_runs` dictionary when evolution starts
- This preserves the actual output directory path for each run

```python
active_runs[run_id] = {
    "controller": controller,
    "status": "running",
    # ... other fields ...
    "output_dir": controller.output_dir,  # Store for data retrieval
}
```

### 2. Created Run-Specific Data Endpoint
**File: `openevolve/server_api/routes/evolution.py`**
- Added new endpoint: `GET /api/evolution/{run_id}/data`
- This endpoint uses the stored output directory for that specific run
- Returns checkpoint data from the correct location

### 3. Updated Program Details Endpoint
**File: `openevolve/server_api/routes/evolution.py`**
- Modified `/api/evolution/program/{program_id}` to accept optional `run_id` parameter
- When `run_id` is provided, uses that run's output directory
- Falls back to examples/ for historical runs or manual queries

### 4. Updated Frontend API Client
**File: `desktop/src/renderer/api/client.ts`**
- Modified `getEvolutionData()` to accept optional `runId` parameter
- When `runId` is provided, calls the new run-specific endpoint
- Falls back to `/api/data` for general queries

```typescript
async getEvolutionData(runId?: string, checkpointPath?: string): Promise<EvolutionData> {
  if (runId) {
    // Get data for specific active run
    url = `${this.baseUrl}/api/evolution/${runId}/data`;
  } else if (checkpointPath) {
    // Get data from specific path
    url = `${this.baseUrl}/api/data?path=${encodeURIComponent(checkpointPath)}`;
  } else {
    // Default: examples directory
    url = `${this.baseUrl}/api/data`;
  }
  // ...
}
```

- Modified `getProgramDetails()` to accept optional `runId` parameter
- Passes `run_id` as query parameter when provided

### 5. Updated Evolution View Component
**File: `desktop/src/renderer/components/Dashboard/EvolutionView.tsx`**
- Passes `currentRun?.id` when calling `getEvolutionData()`
- Ensures evolution data is loaded from the correct output directory
- Added `currentRun?.id` to dependency arrays for proper reactivity

### 6. Updated Program Viewer Component
**File: `desktop/src/renderer/components/ProgramViewer/index.tsx`**
- Accesses `currentRun` from app store
- Passes `currentRun?.id` when calling `getProgramDetails()`
- Ensures program details are loaded from the correct output directory

## Data Flow

### Before Fix
```
UI requests data → /api/data → defaults to examples/ → No data found ❌
```

### After Fix
```
UI starts evolution → Run stored with output_dir
UI requests data → /api/evolution/{run_id}/data → Uses stored output_dir → Data found ✅
```

## Testing
1. Start the desktop app
2. Start an evolution run
3. Verify logs no longer show "No checkpoint folders found in examples/"
4. Verify Evolution tab shows graph data once checkpoints are created
5. Verify clicking on nodes shows program details
6. Verify data persists across UI refreshes during the same run

## Benefits
- Correct data retrieval for active evolution runs
- Eliminates confusion about where data is stored
- Works with both temporary directories and custom output paths
- Maintains backward compatibility with examples/ directory
- Each run is isolated and doesn't interfere with others

## Related Files
- `openevolve/server_api/routes/evolution.py` - Backend route handlers
- `desktop/src/renderer/api/client.ts` - API client methods
- `desktop/src/renderer/components/Dashboard/EvolutionView.tsx` - Evolution visualization
- `desktop/src/renderer/components/ProgramViewer/index.tsx` - Program details viewer
