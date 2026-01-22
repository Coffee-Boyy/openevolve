import { useState } from 'react';
import * as Tabs from '@radix-ui/react-tabs';
import Header from './Header';
import StatusPanel from './StatusPanel';
import SetupView from './SetupView';
import EvolutionView from './EvolutionView';
import ConfigView from './ConfigView';
import LogsView from './LogsView';

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState('setup');

  return (
    <div className="flex flex-col h-full bg-background">
      <Header />
      <div className="flex-1 flex overflow-hidden">
        <StatusPanel />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Tabs.Root value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
            <Tabs.List className="flex border-b border-border px-4">
              <Tabs.Trigger
                value="setup"
                className="px-4 py-2 text-sm font-medium border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary"
              >
                Setup
              </Tabs.Trigger>
              <Tabs.Trigger
                value="evolution"
                className="px-4 py-2 text-sm font-medium border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary"
              >
                Evolution
              </Tabs.Trigger>
              <Tabs.Trigger
                value="config"
                className="px-4 py-2 text-sm font-medium border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary"
              >
                Configuration
              </Tabs.Trigger>
              <Tabs.Trigger
                value="logs"
                className="px-4 py-2 text-sm font-medium border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary"
              >
                Logs
              </Tabs.Trigger>
            </Tabs.List>
            <Tabs.Content value="setup" className="flex-1 overflow-hidden">
              <SetupView />
            </Tabs.Content>
            <Tabs.Content value="evolution" className="flex-1 overflow-hidden">
              <EvolutionView />
            </Tabs.Content>
            <Tabs.Content value="config" className="flex-1 overflow-hidden">
              <ConfigView />
            </Tabs.Content>
            <Tabs.Content value="logs" className="flex-1 min-h-0 overflow-hidden">
              <LogsView />
            </Tabs.Content>
          </Tabs.Root>
        </div>
      </div>
    </div>
  );
}
