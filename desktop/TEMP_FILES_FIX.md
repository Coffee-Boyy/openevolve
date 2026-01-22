# Temporary Files Fix

## Issue

When clicking "Start Evolution", the UI was prompting the user to select a directory for temporary files, which was confusing and unnecessary.

## Root Cause

The `StatusPanel.tsx` component was calling:
```typescript
const tempDir = await window.electronAPI.openDirectoryDialog();
```

This opened a directory selection dialog, requiring the user to manually choose where to save temporary files.

## Solution

Implemented automatic temporary directory creation:

### 1. Added IPC Handler (`ipc.ts`)

```typescript
ipcMain.handle('fs:getTempDir', async () => {
  try {
    const tempBase = os.tmpdir();
    const tempDir = path.join(tempBase, 'openevolve', `run-${Date.now()}`);
    await fs.mkdir(tempDir, { recursive: true });
    return tempDir;
  } catch (error) {
    throw new Error(`Failed to create temp directory: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
});
```

This creates a unique temporary directory for each evolution run:
- Location: System temp directory (e.g., `/tmp` on macOS/Linux, `%TEMP%` on Windows)
- Format: `openevolve/run-{timestamp}/`
- Automatically created if it doesn't exist

### 2. Exposed API (`preload/index.ts`)

```typescript
getTempDir: () => ipcRenderer.invoke('fs:getTempDir'),
```

Added type definition:
```typescript
getTempDir: () => Promise<string>;
```

### 3. Updated StatusPanel (`StatusPanel.tsx`)

Changed from:
```typescript
const tempDir = await window.electronAPI.openDirectoryDialog();
if (!tempDir) return;
```

To:
```typescript
const tempDir = await window.electronAPI.getTempDir();
```

Now the temporary directory is created automatically without user interaction.

## Behavior Now

1. User clicks "Start Evolution"
2. System automatically creates temp directory (e.g., `/tmp/openevolve/run-1234567890/`)
3. Initial program and evaluator are written to temp directory
4. Evolution starts immediately without prompts
5. User may optionally choose a config file (separate prompt)

## Temporary File Locations

### Development
- macOS: `/var/folders/.../T/openevolve/run-{timestamp}/`
- Linux: `/tmp/openevolve/run-{timestamp}/`
- Windows: `C:\Users\{user}\AppData\Local\Temp\openevolve\run-{timestamp}\`

### Files Created
- `initial_program.ts` - The initial program from Setup tab
- `evaluator.ts` - The evaluation function from Setup tab

## Cleanup

Temporary files are automatically cleaned up by the OS:
- macOS: Cleaned on reboot or by system maintenance
- Linux: Cleaned based on `/tmp` cleanup policy
- Windows: Cleaned by Disk Cleanup utility

For manual cleanup, users can delete the `openevolve` folder in their system temp directory.

## Benefits

1. **Better UX**: No confusing directory selection dialog
2. **Automatic**: System handles temp directory creation
3. **Unique**: Each run gets its own directory (no conflicts)
4. **Standard**: Uses OS temp directory conventions
5. **Clean**: OS handles cleanup automatically

## Related Files

- `/desktop/src/main/ipc.ts` - Added `fs:getTempDir` handler
- `/desktop/src/preload/index.ts` - Exposed `getTempDir` API
- `/desktop/src/renderer/components/Dashboard/StatusPanel.tsx` - Updated to use automatic temp dir

## Testing

To verify the fix:

1. Open the desktop app
2. Go to Setup tab and configure code
3. Click "Start Evolution"
4. Should NOT see directory selection dialog
5. Should start evolution immediately (or prompt for config file only)
6. Check system temp directory to verify files were created

## Future Enhancements

Potential improvements:

1. **Cleanup on success**: Delete temp files after successful run
2. **Configurable location**: Allow users to set temp directory location
3. **Disk space check**: Warn if temp directory is low on space
4. **Archive old runs**: Move temp files to archive instead of deleting
5. **Run history**: Keep track of temp directories for debugging
