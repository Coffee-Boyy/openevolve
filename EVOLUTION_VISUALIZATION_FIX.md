# Evolution Visualization Fix

## Problem
The Evolution tab was not showing any visualization during runtime. The graph remained empty even though evolution was running and iterations were progressing.

## Root Cause
The default `checkpoint_interval` is set to 100 iterations, meaning checkpoint data (which the visualization uses) is only saved every 100 iterations. For UI users wanting real-time feedback, this made the visualization appear broken until 100+ iterations had completed.

## Solutions Implemented

### 1. Reduced Checkpoint Interval for UI Runs
**File: `openevolve/server_api/routes/evolution.py`**

When evolution starts via the UI, the checkpoint interval is automatically adjusted from 100 to 10 iterations:

```python
# For UI runs, save checkpoints more frequently for better visualization
if config.checkpoint_interval > 10:
    logger.info(f"Adjusting checkpoint_interval from {config.checkpoint_interval} to 10 for UI visualization")
    config.checkpoint_interval = 10
```

**Result**: Visualization updates every 10 iterations instead of 100

### 2. Live Database Fallback
**File: `openevolve/server_api/routes/evolution.py`**

Added `generate_live_evolution_data()` function that reads directly from the controller's database when checkpoint files aren't available yet:

```python
def generate_live_evolution_data(controller):
    """Generate evolution data from the live database"""
    # Reads programs, edges, and archive directly from database
    # Returns same format as checkpoint data
```

Modified `/api/evolution/{run_id}/data` endpoint to:
1. Try loading from checkpoint files first (preferred, more efficient)
2. Fall back to generating live data from database if no checkpoints exist
3. Return empty data if nothing is available

**Result**: Visualization shows data immediately, even before the first checkpoint

### 3. Better Empty State Message
**File: `desktop/src/renderer/components/EvolutionGraph/index.tsx`**

Added a user-friendly message when no data is available:
- Shows an icon and message explaining data will appear soon
- Informs users that data is saved every 10 iterations
- Better UX than a blank screen

## Data Flow

### Before First Checkpoint (Iterations 1-9)
```
UI requests data → No checkpoint exists → Generate from live database → Show visualization ✅
```

### After Checkpoints (Iterations 10+)
```
UI requests data → Load from checkpoint file → Show visualization ✅
```

### Polling & Updates
```
Every 10 seconds (polling) → Request data → Update visualization
OR
WebSocket update received → Request data → Update visualization
```

## Benefits

✅ **Immediate Feedback**: Data appears as soon as the first program is evaluated
✅ **Regular Updates**: Visualization refreshes every 10 iterations via checkpoints
✅ **Seamless Experience**: No waiting for 100 iterations to see results
✅ **Live Data**: Falls back to database when checkpoints aren't ready
✅ **Efficient**: Uses checkpoint files when available (faster than live generation)
✅ **Backward Compatible**: CLI runs still use default checkpoint interval

## Configuration

### UI Runs (Automatic)
- Checkpoint interval: **10 iterations** (automatically adjusted)
- Visualization updates every: **10 iterations**
- Additional polling: **Every 10 seconds**

### CLI Runs (Default)
- Checkpoint interval: **100 iterations** (config default)
- Can be customized in config file

## Testing

1. Start the desktop app
2. Start an evolution run
3. Switch to Evolution tab
4. Verify:
   - Message appears initially: "No Evolution Data Yet"
   - After iteration 1 completes, programs start appearing in the graph
   - Graph updates every 10 iterations (or when WebSocket sends updates)
   - Nodes are colored by island
   - Can click nodes to view program details
   - Layout updates as new programs are added

## Technical Details

### Checkpoint Data Structure
```json
{
  "nodes": [
    {
      "id": "program-id",
      "code": "...",
      "metrics": {"combined_score": 1.23, ...},
      "generation": 0,
      "parent_id": "parent-id",
      "island": 0,
      "iteration": 5,
      "method": "mutation"
    }
  ],
  "edges": [
    {"source": "parent-id", "target": "child-id"}
  ],
  "archive": ["best-program-id-1", "best-program-id-2"],
  "checkpoint_dir": "/path/to/checkpoint" or "live"
}
```

### Live Data Generation
- Reads all programs from `controller.database.programs`
- Constructs nodes with all metadata
- Creates edges based on parent-child relationships
- Includes archive (best programs)
- Matches checkpoint data format exactly

## Files Modified

- `openevolve/server_api/routes/evolution.py` - Reduced checkpoint interval, added live data generation
- `desktop/src/renderer/components/EvolutionGraph/index.tsx` - Added empty state message
- `openevolve/config.py` - (Reference: default checkpoint_interval = 100)
- `openevolve/controller.py` - (Reference: uses checkpoint_interval)

## Related Issues

- Fixes: "Evolution tab shows no data during runtime"
- Improves: User experience for real-time monitoring
- Maintains: Performance and efficiency with checkpoint files
