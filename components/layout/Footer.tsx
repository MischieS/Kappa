import { ExternalLink } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t border-zinc-800 bg-zinc-950 py-6 text-sm text-zinc-400">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 md:flex-row md:px-6 lg:px-8">
        <div className="flex flex-col gap-1 text-center md:text-left">
          <p>
            TarkovTracker is an open-source project.
          </p>
          <p className="text-zinc-500">
            Game content and materials are trademarks and copyrights of Battlestate Games.
          </p>
        </div>
        
        <div className="flex flex-wrap justify-center gap-6 md:justify-end">
          <a
            href="https://reemr.se/"
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center gap-1.5 transition-colors hover:text-zinc-200"
          >
            <span>Maps by Reemr</span>
            <ExternalLink className="h-3 w-3 opacity-50 transition-opacity group-hover:opacity-100" />
          </a>
          
          <a
            href="https://tarkov.dev/"
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center gap-1.5 transition-colors hover:text-zinc-200"
          >
            <span>Data by tarkov.dev</span>
            <ExternalLink className="h-3 w-3 opacity-50 transition-opacity group-hover:opacity-100" />
          </a>

          <a
            href="https://escapefromtarkov.fandom.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center gap-1.5 transition-colors hover:text-zinc-200"
          >
            <span>Wiki API</span>
            <ExternalLink className="h-3 w-3 opacity-50 transition-opacity group-hover:opacity-100" />
          </a>
        </div>
      </div>
    </footer>
  );
}
