import type { ReactNode } from "react";
import { TopNav } from "@/components/layout/TopNav";
import { Footer } from "@/components/layout/Footer";

export interface AppShellProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}

export function AppShell({ title: _title, subtitle: _subtitle, actions: _actions, children }: AppShellProps) {
  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-zinc-950 via-zinc-950 to-black text-zinc-100">
      <TopNav />
      <div className="flex-1">
        <main className="px-4 py-4 md:px-6 md:py-6 lg:px-8 lg:py-7">
          <div className="mx-auto max-w-6xl space-y-6">{children}</div>
        </main>
      </div>
      <Footer />
    </div>
  );
}
