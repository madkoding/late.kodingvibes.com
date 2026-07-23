// Microfront slot. The shell renders this empty div on /irc; the
// late-micro-chat bundle auto-mounts its React tree into it. See
// AGENTS.md "Web UI (React)".
export function Irc() {
  return <div id="micro-chat-root" />;
}
