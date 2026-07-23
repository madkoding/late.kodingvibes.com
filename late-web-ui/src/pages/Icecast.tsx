// Microfront slot. The shell renders this empty div on /icecast; the
// late-micro-radio bundle auto-mounts its React tree into it. See
// AGENTS.md "Web UI (React)".
export function Icecast() {
  return <div id="micro-radio-root" />;
}
