# Configuration Persistence Fix

## Issues Fixed

### 1. Config Not Using Saved API Key
**Problem**: When starting evolution from the UI, the saved API key and other config settings were ignored, causing "API key must be set" errors.

**Root Cause**: The evolution start endpoint was creating a new `Config()` instead of using the configuration saved via the UI.

### 2. Config Reset on Application Reload
**Problem**: Configuration settings were lost every time the application was restarted.

**Root Cause**: The `current_config` was stored only in memory (global variable) and reset when the Python sidecar restarted.

## Solutions

### 1. Use Saved Config for Evolution Runs

Updated `/openevolve/server_api/routes/evolution.py`:

```python
# Load configuration
if request.config_path and os.path.exists(request.config_path):
    config = load_config(request.config_path)
else:
    # Use the current config from the config router if available
    from openevolve.server_api.routes import config as config_module
    if config_module.current_config is not None:
        config = config_module.current_config
        logger.info("Using configuration from UI settings")
    else:
        config = Config()
        logger.info("Using default configuration")
    
    # Ensure API key from environment is applied if not set in config
    if not config.llm.api_key:
        api_key = os.environ.get("OPENAI_API_KEY")
        if api_key:
            logger.info("Using OPENAI_API_KEY from environment")
            config.llm.update_model_params({"api_key": api_key})
```

**Benefits**:
- Uses UI-configured settings by default
- Falls back to environment variables if needed
- Falls back to default config as last resort
- Clear logging of which config source is used

### 2. Persistent Config Storage

Added persistent storage to `/openevolve/server_api/routes/config.py`:

#### Storage Location
```python
def get_user_config_path() -> Path:
    """Get path to user's persistent config file"""
    config_dir = Path.home() / ".openevolve"
    config_dir.mkdir(exist_ok=True)
    return config_dir / "ui_config.yaml"
```

**Config file location**:
- macOS/Linux: `~/.openevolve/ui_config.yaml`
- Windows: `C:\Users\{username}\.openevolve\ui_config.yaml`

#### Auto-Save on Update
```python
@router.put("")
async def update_config(update: ConfigUpdate):
    # ... validate and update config ...
    
    # Save to persistent storage
    config_path = get_user_config_path()
    try:
        current_config.to_yaml(config_path)
        logger.info(f"Saved config to {config_path}")
    except Exception as save_error:
        logger.error(f"Failed to save config: {save_error}")
        # Don't fail the request if saving fails
    
    return {"status": "success", "config": current_config.to_dict()}
```

**Benefits**:
- Automatic persistence on every config update
- Fails gracefully if save fails
- Clear logging

#### Auto-Load on Startup
```python
@router.get("")
async def get_config():
    global current_config
    
    if current_config is None:
        # Try to load from persistent storage first
        current_config = load_persistent_config()
        
        if current_config is None:
            logger.info("No persistent config found, using defaults")
            current_config = Config()
    
    return current_config.to_dict()
```

#### Load on Server Startup
Updated `/openevolve/server_api/server.py`:

```python
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting OpenEvolve API server")
    
    # Load persistent config on startup
    try:
        from openevolve.server_api.routes.config import load_persistent_config
        loaded_config = load_persistent_config()
        if loaded_config:
            from openevolve.server_api.routes import config as config_module
            config_module.current_config = loaded_config
            logger.info("Loaded persistent configuration from user settings")
    except Exception as e:
        logger.warning(f"Failed to load persistent config on startup: {e}")
    
    yield
    logger.info("Shutting down OpenEvolve API server")
```

**Benefits**:
- Config restored immediately when server starts
- No UI interaction needed to restore settings
- Graceful fallback if loading fails

## User Experience

### Before
1. User configures API key in UI ❌
2. User starts evolution → **Error: API key not set**
3. User restarts app → **All settings lost**
4. User has to reconfigure everything

### After
1. User configures API key in UI ✅
2. Config automatically saved to `~/.openevolve/ui_config.yaml`
3. User starts evolution → **Uses saved config** ✅
4. User restarts app → **Config automatically restored** ✅
5. Settings persist across sessions

## Configuration Priority

The system now uses this priority order for configuration:

1. **Explicit config file path** (highest priority)
   - If user provides a specific config file to evolution start

2. **UI-saved configuration**
   - Settings configured via the Configuration tab
   - Persisted to `~/.openevolve/ui_config.yaml`

3. **Environment variables**
   - `OPENAI_API_KEY` for API key
   - `OPENAI_API_BASE` for API base URL

4. **Default configuration** (lowest priority)
   - Built-in defaults if nothing else is configured

## Testing

### Test Config Persistence
1. Open desktop app
2. Go to Configuration tab
3. Add API key: `api_key: sk-test-123`
4. Click "Save Configuration"
5. Quit and restart the app
6. Go to Configuration tab
7. **Verify**: API key is still present ✅

### Test Evolution with Saved Config
1. Configure API key in UI
2. Go to Setup tab and configure program/evaluator
3. Click "Start Evolution"
4. Check logs: Should see "Using configuration from UI settings"
5. **Verify**: Evolution starts without API key error ✅

### Test Priority
1. Set `OPENAI_API_KEY=env-key` in environment
2. Configure `api_key: ui-key` in UI
3. Start evolution
4. **Verify**: Uses `ui-key` (UI takes priority) ✅
5. Remove `api_key` from UI config
6. Start evolution again
7. **Verify**: Uses `env-key` (environment fallback) ✅

## Troubleshooting

### Config File Location
To find your config file:
- **macOS/Linux**: `cat ~/.openevolve/ui_config.yaml`
- **Windows**: `type %USERPROFILE%\.openevolve\ui_config.yaml`

### Config Not Saving
Check logs for errors like:
```
ERROR - Failed to save config to persistent storage: [permission denied]
```

**Solution**: Ensure write permissions for `~/.openevolve/` directory

### Config Not Loading
Check logs on startup:
```
INFO - Loaded persistent configuration from user settings  ✅
# or
WARNING - Failed to load persistent config on startup: [error]  ❌
```

### Reset to Defaults
To reset all settings:
1. Delete the config file:
   - macOS/Linux: `rm ~/.openevolve/ui_config.yaml`
   - Windows: `del %USERPROFILE%\.openevolve\ui_config.yaml`
2. Restart the application

## Files Modified

1. `/openevolve/server_api/routes/config.py`
   - Added `get_user_config_path()` function
   - Added `load_persistent_config()` function
   - Updated `get_config()` to load from persistent storage
   - Updated `update_config()` to auto-save to persistent storage

2. `/openevolve/server_api/routes/evolution.py`
   - Updated `start_evolution()` to use saved UI config
   - Added fallback to environment variables
   - Added better logging

3. `/openevolve/server_api/server.py`
   - Updated `lifespan()` to load config on startup

## Security Considerations

- Config file is stored in user's home directory (user-only access)
- API keys are stored in plain text (same as environment variables)
- For better security, consider:
  - Using environment variables for sensitive data
  - Using system keychain integration (future enhancement)
  - Encrypting the config file (future enhancement)

## Future Enhancements

Potential improvements:

1. **Keychain integration**: Store API keys in system keychain
2. **Config versioning**: Track config schema versions for migrations
3. **Multiple profiles**: Support different config profiles
4. **Config validation**: UI validation before saving
5. **Config import/export**: Share configs between machines
6. **Encrypted storage**: Encrypt sensitive fields in config file
7. **Config history**: Keep backup of previous configs
