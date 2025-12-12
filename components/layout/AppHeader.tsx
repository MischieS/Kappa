import type { ReactNode } from "react";
import { Bell, Settings } from "lucide-react";
import { Button } from "@/components/ui/Button";

export interface AppHeaderProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}

export function AppHeader({ title, subtitle, actions }: AppHeaderProps) {
  return (
    <header className="flex h-16 items-center justify-between border-b border-zinc-900/80 bg-zinc-950/80 px-4 backdrop-blur-md md:px-6 lg:px-8">
      <div className="space-y-0.5">
        <h1 className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">
          {title}
        </h1>
        {subtitle ? (
          <p className="text-xs text-zinc-500">{subtitle}</p>
        ) : null}
      </div>
      <div className="flex items-center gap-2">
        {actions}
        <Button
          variant="ghost"
          size="sm"
          aria-label="Notifications"
          className="hidden md:inline-flex"
        >
          <Bell className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          aria-label="Settings"
          className="hidden md:inline-flex"
        >
          <Settings className="h-3.5 w-3.5" />
        </Button>
      </div>
    </header>
  );
}
