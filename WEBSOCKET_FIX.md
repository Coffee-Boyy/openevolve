# WebSocket Real-Time Updates Fix

## Problem
The evolution was running properly (iterations increasing, API requests visible) but no data was appearing in the Evolution or Logs tabs in the desktop UI. The frontend was only showing status updates from polling, not real-time WebSocket updates.

## Root Cause
The backend evolution controller had no mechanism to broadcast progress updates via WebSocket. While the evolution was running and saving data to the database, it wasn't pushing updates to connected WebSocket clients.

## Solution

### 1. Added Progress Callback System to Controller
**File: `openevolve/controller.py`**
- Added `progress_callback` parameter to `OpenEvolve.__init__()`
- This callback is called during checkpoints to broadcast iteration updates

### 2. Added Iteration-Level Progress Updates  
**File: `openevolve/process_parallel.py`**
- Added controller reference to `ProcessParallelController`
- Added progress callback invocation after each iteration completes (not just at checkpoints)
- This ensures the UI gets updates frequently, not just every 10-50 iterations

### 3. Created WebSocket Logging Handler
**File: `openevolve/server_api/websocket.py`**
- Implemented `WebSocketLogHandler` class that extends `logging.Handler`
- Captures log messages and broadcasts them via WebSocket in real-time
- Formatted as log messages with level, source, and timestamp

### 4. Integrated WebSocket Broadcasting in Evolution Route
**File: `openevolve/server_api/routes/evolution.py`**
- Created `progress_callback` function that broadcasts messages via `manager.broadcast_to_run()`
- Passed callback to `OpenEvolve` controller  
- Added `WebSocketLogHandler` to capture all "openevolve" logger output
- Handler is added when evolution starts and removed when it completes

### 5. Enhanced WebSocket Endpoint
**File: `openevolve/server_api/server.py`**
- Added subscription command handling in WebSocket endpoint
- Clients can send `{"command": "subscribe", "run_id": "..."}` to subscribe to a specific run's updates
- Changed from `eval()` to safe `json.loads()` for parsing messages

### 6. Frontend WebSocket Subscription
**File: `desktop/src/renderer/api/client.ts`**
- Added `subscribeToRun()` method to API client
- Added `unsubscribeFromRun()` method

**File: `desktop/src/renderer/hooks/useEvolution.ts`**
- Automatically subscribe to WebSocket updates when evolution starts
- Updates include `lastUpdate` timestamp to trigger UI refreshes

### 7. Real-Time UI Updates
**File: `desktop/src/renderer/store/appStore.ts`**
- Added `lastUpdate` field to `EvolutionRun` interface

**File: `desktop/src/renderer/hooks/useWebSocket.ts`**
- Enhanced `iteration_update` handler to set `lastUpdate` timestamp

**File: `desktop/src/renderer/components/Dashboard/EvolutionView.tsx`**
- Added effect that reloads evolution data when `lastUpdate` changes
- Reduced polling interval from 5s to 10s since WebSocket provides real-time updates

**File: `desktop/src/renderer/components/LogViewer/index.tsx`**
- Already configured to handle WebSocket log messages

## Message Types

### Iteration Update
```json
{
  "type": "iteration_update",
  "run_id": "...",
  "iteration": 42,
  "best_score": 1.234,
  "metrics": {...},
  "best_program_id": "..."
}
```

### Log Message
```json
{
  "type": "log",
  "run_id": "...",
  "level": "info",
  "message": "...",
  "source": "openevolve.controller",
  "timestamp": 1234567890.123
}
```

### Evolution Complete
```json
{
  "type": "evolution_complete",
  "run_id": "..."
}
```

### Evolution Error
```json
{
  "type": "evolution_error",
  "run_id": "...",
  "error": "error message"
}
```

## Testing
1. Start the desktop app
2. Configure and start an evolution run
3. Verify that:
   - Logs appear in real-time in the Logs tab
   - Evolution graph updates as iterations complete
   - Status panel shows current iteration and best score
   - Updates appear within seconds of each iteration completing

## Benefits
- Real-time feedback without polling overhead
- Logs stream live to the UI
- Better user experience with immediate updates
- Lower server load (less frequent polling)
- Scalable architecture for future real-time features
