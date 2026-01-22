# Evolution Viewer Implementation

This document describes the enhanced evolution viewer in the OpenEvolve desktop application, which displays both the evolution graph and the program code that is being evolved.

## Features

### 1. **Split-Pane Layout**
   - Left pane: Interactive evolution graph (D3-based)
   - Right pane: Program code viewer with Monaco editor
   - Resizable divider between panes (drag to adjust)

### 2. **Evolution Graph** (`EvolutionGraph` component)

Based on the original `visualizer.py` implementation with improvements:

#### Visual Features
- **Force-directed graph** using D3.js force simulation
- **Node coloring** by island (using D3's category10 color scheme)
- **Node sizing** based on combined score metric
- **Interactive zoom and pan** with mouse wheel and drag
- **Node selection** with red border for selected node
- **Hover effects** with yellow highlight
- **Real-time updates** during evolution runs (polls every 5 seconds)

#### Interactions
- **Click node**: Select and view code in right pane
- **Drag node**: Reposition individual nodes
- **Scroll wheel**: Zoom in/out
- **Drag canvas**: Pan around the graph
- **Click background**: Deselect node

#### Visual Indicators
- **Node color**: Represents island (different colors for each island)
- **Node size**: Larger nodes have higher scores
- **Red border**: Selected node
- **Yellow border**: Hovered node
- **Edge thickness**: Regular edges (2px), selected node edges (4px in red)

#### Hover Tooltip
Shows quick info when hovering over a node:
- Program ID (shortened)
- Generation number
- Island number
- Combined score (if available)

#### Legend
Fixed legend in top-right corner showing:
- Controls and keyboard shortcuts
- Interaction guide

### 3. **Program Viewer** (`ProgramViewer` component)

Displays detailed information about the selected program:

#### Header Section
- **Program ID** (shortened, monospace)
- **Generation number**
- **Iteration number**
- **Island number**
- **Method** (mutation type, if available)

#### Metrics Section
- All available metrics displayed in a grid
- Formatted to 6 decimal places
- Sorted alphabetically

#### Code Editor
- **Monaco Editor** integration (same as VS Code)
- **Syntax highlighting** for Python
- **Read-only mode** (code cannot be edited)
- **Minimap** for navigation
- **Line numbers**
- **Word wrap** enabled
- **Theme-aware** (light/dark mode)

#### Artifacts Section (if available)
- JSON artifacts displayed in formatted view
- Scrollable section at bottom
- Syntax-highlighted JSON

#### Empty State
Shows helpful message when no program is selected:
- Icon indicator
- Instructions to click a node

### 4. **API Integration**

#### New API Endpoints

##### Get Program Details
```
GET /api/evolution/program/{program_id}
```

Returns complete program information:
- Program code
- All metrics
- Generation/iteration info
- Parent relationships
- Artifacts (if any)

##### Get Evolution Data
```
GET /api/data?path={checkpoint_path}
```

Returns graph data:
- Nodes (all programs)
- Edges (parent-child relationships)
- Archive list
- Checkpoint directory path

#### Data Flow

1. **Initial Load**:
   - App starts → Fetch evolution data
   - Display graph with all nodes

2. **During Evolution**:
   - Poll `/api/data` every 5 seconds
   - Update graph with new nodes
   - Maintain zoom/pan state

3. **Node Selection**:
   - User clicks node → Set `selectedProgramId`
   - Fetch program details from `/api/evolution/program/{id}`
   - Display code and metrics in right pane

4. **Real-time Updates**:
   - WebSocket connection for live updates
   - Graph refreshes automatically
   - Selected program remains highlighted

### 5. **Split Pane Resizing**

- Click and drag the divider between graph and code viewer
- Constrained between 30% and 80% for graph width
- Smooth resizing with visual feedback
- Hover effect on divider (blue highlight)
- Active drag effect (stays blue while dragging)

## Component Architecture

```
Dashboard
└── EvolutionView (Split layout container)
    ├── EvolutionGraph (Left: D3 graph)
    │   ├── SVG canvas
    │   ├── Zoom/pan controls
    │   ├── Hover tooltip
    │   └── Legend
    ├── Resizable Divider
    └── ProgramViewer (Right: Code editor)
        ├── Header (Metrics & info)
        ├── Monaco Editor (Code)
        └── Artifacts (Optional)
```

## Data Structure

### Node Structure
```typescript
{
  id: string;              // Unique program ID
  code: string;            // Full program code
  metrics: {               // All evaluation metrics
    combined_score: number;
    [key: string]: number;
  };
  generation: number;      // Generation number
  iteration: number;       // Iteration when created
  island: number;          // Island ID
  parent_id?: string;      // Parent program ID
  method?: string;         // Mutation method
  artifacts_json?: any;    // Optional artifacts
}
```

### Edge Structure
```typescript
{
  source: string;  // Parent program ID
  target: string;  // Child program ID
}
```

## Graph Layout Algorithm

Uses D3's force simulation with the following forces:

1. **Link Force**: Connects parent-child nodes (distance: 80px)
2. **Charge Force**: Repels nodes from each other (strength: -200)
3. **Center Force**: Pulls nodes toward center of canvas
4. **Collision Force**: Prevents node overlap (radius: 40px)

The simulation runs continuously and can be dragged/repositioned by users.

## Styling

### Theme Support
- Automatically adapts to light/dark theme
- Graph colors adjust based on theme
- Monaco editor theme changes
- Border and background colors adapt

### Color Scheme
- **Islands**: D3 category10 colors (10 distinct colors)
- **Selection**: Red (#ef4444)
- **Hover**: Yellow (#fbbf24)
- **Primary**: Theme-based primary color
- **Background**: Theme-based background

## Performance Optimizations

1. **Efficient Rendering**:
   - D3 uses enter/update/exit pattern
   - Only re-renders when data changes
   - Simulation can be paused/resumed

2. **Polling Strategy**:
   - Only polls when evolution is running
   - 5-second interval (configurable)
   - Cleans up on unmount

3. **Code Viewer**:
   - Monaco editor lazy loads
   - Read-only mode reduces overhead
   - Automatic layout sizing

4. **Memory Management**:
   - Simulation stops on component unmount
   - WebSocket properly cleaned up
   - Event listeners removed

## Comparison with Original Visualizer

### Similarities
- Same D3-based graph layout
- Island-based coloring
- Score-based node sizing
- Parent-child edge relationships
- Interactive zoom/pan

### Enhancements
- **Integrated code viewer** (no separate window needed)
- **Resizable panes** for flexible viewing
- **Real-time updates** during evolution
- **Better hover states** with tooltips
- **Theme support** (light/dark mode)
- **Monaco editor** with syntax highlighting
- **Cleaner UI** with modern design
- **Better performance** with React optimization

## Future Enhancements

Potential improvements:

1. **Graph Filtering**:
   - Filter by island
   - Filter by score range
   - Filter by generation

2. **Search**:
   - Search nodes by ID
   - Search code content
   - Jump to specific generation

3. **Comparison View**:
   - Side-by-side code comparison
   - Diff view between parent/child
   - Metric comparison table

4. **Export**:
   - Export graph as image
   - Export program code
   - Export metrics as CSV

5. **Analytics**:
   - Score distribution chart
   - Generation progression
   - Island statistics

## Usage Tips

1. **Best Practices**:
   - Start with zoom level 100% for overview
   - Use search/filter for large graphs
   - Resize panes based on code length
   - Use hover tooltips for quick info

2. **Keyboard Shortcuts** (future):
   - `Ctrl + 0`: Reset zoom
   - `Ctrl + F`: Find node
   - `Escape`: Deselect node
   - `Ctrl + /`: Toggle legend

3. **Performance**:
   - Large graphs (>1000 nodes) may be slow
   - Consider filtering or pagination
   - Disable real-time polling if needed

## Technical Notes

### Dependencies
- `d3`: ^7.8.5 - Graph visualization
- `@monaco-editor/react`: ^4.6.0 - Code editor
- `react`: ^18.2.0 - UI framework

### Browser Compatibility
- Chrome/Edge: Full support
- Firefox: Full support
- Safari: Full support
- Minimum: ES2020 support required

### File Locations
- Graph: `/desktop/src/renderer/components/EvolutionGraph/index.tsx`
- Viewer: `/desktop/src/renderer/components/ProgramViewer/index.tsx`
- Layout: `/desktop/src/renderer/components/Dashboard/EvolutionView.tsx`
- API: `/desktop/src/renderer/api/client.ts`
- Backend: `/openevolve/server_api/routes/evolution.py`
