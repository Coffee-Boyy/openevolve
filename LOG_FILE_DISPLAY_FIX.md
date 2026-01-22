# Log File Display Implementation

## Overview
Added functionality to display logs from the evolution's log files (saved in the output directory) in addition to real-time WebSocket streaming. This provides both historical log viewing and live updates.

## Problem
The LogViewer component only showed simulated logs and didn't display:
- Logs written to files in the evolution's output directory
- Historical logs from past iterations
- Complete log history from the beginning of the run

## Solution

### 1. Backend: Log File Endpoint
**File: `openevolve/server_api/routes/evolution.py`**

Added new endpoint to retrieve logs from files:
```python
@router.get("/{run_id}/logs")
async def get_run_logs(run_id: str)
```

Features:
- Reads log files from `{output_dir}/logs/` directory
- Parses log format: `timestamp - name - level - message`
- Returns structured log data with timestamp, level, message, and source
- Finds the most recent log file automatically
- Handles parsing errors gracefully

### 2. Frontend: API Client Method
**File: `desktop/src/renderer/api/client.ts`**

Added method to fetch logs:
```typescript
async getEvolutionLogs(runId: string): Promise<{ logs: LogEntry[] }>
```

### 3. WebSocket Log Broadcasting
**File: `desktop/src/renderer/hooks/useWebSocket.ts`**

Enhanced WebSocket hook to broadcast log messages:
- Created global `logMessageEvent` EventTarget for log message pub/sub
- Dispatches log events when WebSocket receives log messages
- Allows LogViewer to subscribe without tight coupling

### 4. Enhanced LogViewer Component
**File: `desktop/src/renderer/components/LogViewer/index.tsx`**

Major improvements:
- **File Loading**: Fetches logs from files on mount and periodically (every 5s)
- **WebSocket Integration**: Listens to real-time log events and appends them
- **Deduplication**: Tracks WebSocket log IDs to prevent duplicates
- **Refresh Button**: Manual refresh to reload logs from file
- **Loading State**: Shows loading indicator during fetch
- **Auto-update**: Refreshes logs every 5 seconds while evolution is running
- **Seamless Updates**: Combines file logs (authoritative) with WebSocket logs (real-time)

## Data Flow

### Initial Load
```
UI loads → Fetch logs from file → Parse and display → Subscribe to WebSocket
```

### During Evolution
```
Backend writes log → File system
                  ↓
                  WebSocket broadcast → UI receives → Append to logs
                  ↓
Every 5s → Refresh from file → Replace with authoritative file data
```

### Key Features

1. **Hybrid Approach**
   - File logs are the source of truth (refreshed every 5s)
   - WebSocket provides instant updates between refreshes
   - Deduplication prevents showing the same log twice

2. **Historical Viewing**
   - Can view logs from the start of the run
   - Not limited to only live streaming
   - Persists across UI refreshes

3. **User Controls**
   - Manual refresh button
   - Auto-scroll toggle
   - Level filtering (debug, info, warning, error)
   - Text search/filter
   - Clear logs button

4. **Performance**
   - Only loads most recent log file
   - Efficient parsing with error handling
   - Avoids duplicate log entries

## Log Format

### Backend Log File Format
```
2026-01-21 00:44:16,807 - openevolve.controller - INFO - Logging to /path/to/output/logs/openevolve_20260121_004416.log
```

### Parsed Format
```json
{
  "timestamp": 1737429856.807,
  "level": "info",
  "message": "Logging to /path/to/output/logs/...",
  "source": "openevolve.controller"
}
```

### WebSocket Format
```json
{
  "type": "log",
  "run_id": "...",
  "level": "info",
  "message": "...",
  "source": "openevolve.controller",
  "timestamp": 1737429856.807
}
```

## Testing

1. Start the desktop app
2. Start an evolution run
3. Navigate to the Logs tab
4. Verify:
   - Logs appear from the beginning of the run
   - New logs stream in real-time
   - Refresh button reloads from file
   - Filtering and search work correctly
   - Auto-scroll keeps up with new logs
   - No duplicate log entries appear

## Benefits

✅ Complete log history from start of run
✅ Real-time streaming for immediate feedback  
✅ Reliable (file-based) with fast updates (WebSocket)
✅ Works even if WebSocket connection drops
✅ Survives UI refreshes
✅ Easy debugging with search and filtering
✅ Proper timestamp formatting

## Files Modified

- `openevolve/server_api/routes/evolution.py` - Added `/api/evolution/{run_id}/logs` endpoint
- `desktop/src/renderer/api/client.ts` - Added `getEvolutionLogs()` method
- `desktop/src/renderer/hooks/useWebSocket.ts` - Added log event broadcasting
- `desktop/src/renderer/components/LogViewer/index.tsx` - Complete rewrite with file loading
