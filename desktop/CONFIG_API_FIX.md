# Config API Fix

## Issue

The UI was failing when trying to update configuration via the `/api/config` endpoint.

## Root Cause

**API Mismatch**: The backend expected a different request body format than what the frontend was sending.

### Backend Expectation (FastAPI)

The backend's `ConfigUpdate` model requires the config to be wrapped in a `config` field:

```python
class ConfigUpdate(BaseModel):
    config: Dict[str, Any]
```

Expected request body:
```json
{
  "config": {
    "max_iterations": 100,
    "checkpoint_interval": 5,
    ...
  }
}
```

### Frontend Sending (Before Fix)

The frontend was sending the config object directly without the wrapper:

```typescript
body: JSON.stringify(config)
```

Actual request body sent:
```json
{
  "max_iterations": 100,
  "checkpoint_interval": 5,
  ...
}
```

## Solution

Updated the `updateConfig` method in `/desktop/src/renderer/api/client.ts` to wrap the config:

```typescript
async updateConfig(config: Partial<EvolutionConfig>): Promise<void> {
  const response = await fetch(`${this.baseUrl}/api/config`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ config }), // ✅ Now wrapped correctly
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to update config: ${response.statusText}${errorText ? ` - ${errorText}` : ''}`);
  }
}
```

## Additional Improvements

1. **Better Error Messages**: Now includes response text in error messages for easier debugging
2. **Proper Request Format**: Matches backend expectations exactly
3. **Type Safety**: TypeScript types remain consistent

## Testing

To verify the fix works:

1. Open the desktop app
2. Go to the Configuration tab
3. Edit any configuration value in the YAML editor
4. Click "Save Configuration"
5. Should see success message without errors

## Backend Endpoint Details

**Endpoint**: `PUT /api/config`

**Request Body**:
```json
{
  "config": {
    "max_iterations": 100,
    "checkpoint_interval": 5,
    "random_seed": 42,
    "llm": {
      "models": [...]
    },
    "database": {
      "population_size": 50,
      "num_islands": 3
    }
  }
}
```

**Response** (Success):
```json
{
  "status": "success",
  "config": {
    "max_iterations": 100,
    ...
  }
}
```

**Response** (Error):
```json
{
  "detail": "Error message here"
}
```

## Related Files

- `/openevolve/server_api/routes/config.py` - Backend config routes
- `/desktop/src/renderer/api/client.ts` - Frontend API client (FIXED)
- `/desktop/src/renderer/components/ConfigEditor/index.tsx` - Config editor component

## Prevention

To prevent similar issues in the future:

1. **API Documentation**: Document request/response formats
2. **Type Definitions**: Use shared TypeScript types matching Pydantic models
3. **Integration Tests**: Add tests that verify frontend-backend communication
4. **Error Logging**: Log full request/response in development mode
