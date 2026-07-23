import { lazy, Suspense, useEffect } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AudioProvider } from "@/audio/AudioProvider";
import { TrackMetadataSync } from "@/audio/TrackMetadataSync";
import Home from "@/pages/Home";
import SiteHeader from "@/components/SiteHeader";
import { UpdateNotice } from "@/components/UpdateNotice";
import useViewportHeight from "@/lib/use-viewport-height";

const Icecast = lazy(() => import("@/pages/Icecast/IcecastPage").then((m) => ({ default: m.Icecast })));
const Irc = lazy(() => import("@/pages/Irc").then((m) => ({ default: m.Irc })));

export function App() {
  useViewportHeight();

  // Suppress the native browser context menu everywhere. Custom
  // menus (MessageContextMenu, UserContextMenu, ChannelContextMenu)
  // are responsible for opening their own UI on right-click — we
  // don't want the OS menu competing with them.
  useEffect(() => {
    const onContextMenu = (e: MouseEvent) => {
      e.preventDefault()
    }
    document.addEventListener('contextmenu', onContextMenu)
    return () => document.removeEventListener('contextmenu', onContextMenu)
  }, [])

  return (
    <AudioProvider>
      <TrackMetadataSync />
      <BrowserRouter>
        <SiteHeader />
        <Suspense fallback={<div className="p-8 text-slate-400 min-h-screen bg-slate-950">loading…</div>}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/icecast" element={<Icecast />} />
            <Route path="/irc" element={<Irc />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
      <UpdateNotice />
    </AudioProvider>
  );
}
