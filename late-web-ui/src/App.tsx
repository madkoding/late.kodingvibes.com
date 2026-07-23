import { lazy, Suspense, useEffect } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import Home from "@/pages/Home";
import SiteHeader from "@/components/SiteHeader";
import MiniPlayer from "@/audio/MiniPlayer";
import { UpdateNotice } from "@/components/UpdateNotice";
import useViewportHeight from "@/lib/use-viewport-height";

// Each route renders a microfront slot. The actual UI lives in
// /micro/{radio,chat}/vX.Y.Z/entry.js (see vite.config.ts microfrontsPlugin).
const Icecast = lazy(() => import("@/pages/Icecast").then((m) => ({ default: m.Icecast })));
const Irc     = lazy(() => import("@/pages/Irc").then((m) => ({ default: m.Irc })));

export function App() {
  useViewportHeight();

  // Suppress the native browser context menu everywhere. Custom
  // menus (MessageContextMenu, UserContextMenu, ChannelContextMenu)
  // are responsible for opening their own UI on right-click — we
  // don't want the OS menu competing with them.
  useEffect(() => {
    const onContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };
    document.addEventListener("contextmenu", onContextMenu);
    return () => document.removeEventListener("contextmenu", onContextMenu);
  }, []);

  return (
    <BrowserRouter>
      <SiteHeader />
      <Suspense fallback={<div className="p-8 text-slate-400 min-h-screen bg-slate-950">loading…</div>}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/icecast" element={<Icecast />} />
          <Route path="/irc" element={<Irc />} />
        </Routes>
      </Suspense>
      {/* ponytail: MiniPlayer is global, outside the router. It subscribes
          to window.RadioEngine (provided by late-micro-radio). The micro
          also keeps the <audio> element alive across navigations. */}
      <MiniPlayer />
      <UpdateNotice />
    </BrowserRouter>
  );
}
