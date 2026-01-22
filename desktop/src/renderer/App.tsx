import { useEffect } from 'react';
import { useAppStore } from './store/appStore';
import { useWebSocket } from './hooks/useWebSocket';
import Dashboard from './components/Dashboard';
import { Toaster } from './components/ui/Toast';

function App() {
  const { initializeApp, theme } = useAppStore();
  
  // Initialize WebSocket connection
  useWebSocket();

  useEffect(() => {
    initializeApp();
  }, [initializeApp]);

  useEffect(() => {
    // Apply theme to document
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  return (
    <div className="h-screen w-screen overflow-hidden">
      <Dashboard />
      <Toaster />
    </div>
  );
}

export default App;
