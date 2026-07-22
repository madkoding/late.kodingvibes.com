import { type ReactNode } from "react";

interface Props {
  children: ReactNode;
  title?: string;
}

export function Layout({ children }: Props) {
  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100 font-sans">
      <main className="flex-1">{children}</main>

      <footer className="border-t border-slate-800 bg-slate-900 py-12 mt-auto">
        <div className="kv-section flex flex-col sm:flex-row items-center justify-between gap-6 text-sm text-slate-400">
          <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4">
            <span className="font-semibold text-slate-100">late.kodingvibes.com</span>
            <span className="hidden sm:inline text-slate-600">·</span>
            <span>un experimento comfy de kodingvibes.</span>
          </div>
          <div className="flex items-center gap-6">
            <a
              href="https://www.kodingvibes.com"
              target="_blank"
              rel="noreferrer"
              className="hover:text-indigo-400 transition-colors"
            >
              kodingvibes
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
