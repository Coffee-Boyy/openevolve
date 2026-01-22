import { useAppStore } from '../../store/appStore';
import * as Switch from '@radix-ui/react-switch';

export default function Header() {
  const { theme, setTheme } = useAppStore();

  return (
    <header className="h-14 border-b border-border flex items-center justify-between px-4">
      <div className="flex items-center space-x-4">
        <h1 className="text-xl font-bold">OpenEvolve</h1>
        <span className="text-xs text-muted-foreground">Evolutionary Coding with LLMs</span>
      </div>
      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-2">
          <span className="text-sm text-muted-foreground">☀️</span>
          <Switch.Root
            checked={theme === 'dark'}
            onCheckedChange={(checked) => setTheme(checked ? 'dark' : 'light')}
            className="w-11 h-6 bg-secondary rounded-full relative data-[state=checked]:bg-primary transition-colors"
          >
            <Switch.Thumb className="block w-5 h-5 bg-white rounded-full transition-transform translate-x-0.5 data-[state=checked]:translate-x-[22px]" />
          </Switch.Root>
          <span className="text-sm text-muted-foreground">🌙</span>
        </div>
      </div>
    </header>
  );
}
