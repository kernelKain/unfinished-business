import { useEffect, useRef } from "react";
import { Terminal, X } from "lucide-react";
import { connectCommand } from "../setup.ts";

interface SetupDialogProps {
  open: boolean;
  onClose: () => void;
}

export function SetupDialog({ open, onClose }: SetupDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      className="setup-dialog"
      aria-labelledby="setup-dialog-title"
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="dialog-surface">
        <button className="icon-button dialog-close" type="button" onClick={onClose} aria-label="Close setup dialog">
          <X size={20} aria-hidden="true" />
        </button>
        <p className="eyebrow">Connect the engine</p>
        <h2 id="setup-dialog-title">Point the workshop at your own OpenCode server</h2>
        <p>
          Unfinished Business uses OpenCode for the agent loop, tools, permissions, and native sessions.
          It does not ship a second coding harness and never asks a browser for your OpenCode password.
        </p>
        <ol className="dialog-steps">
          <li>
            <span className="dialog-step-title">Install and start OpenCode</span>
            <pre className="command-block"><code>{connectCommand}</code></pre>
          </li>
          <li>
            <span className="dialog-step-title">Match the server password</span>
            <p>Set <span className="mono">OPENCODE_PASSWORD</span> in your gitignored <span className="mono">.env</span> to the password printed by OpenCode.</p>
          </li>
          <li>
            <span className="dialog-step-title">Open the local workshop</span>
            <p>Start the API and interface, then open <span className="mono">http://127.0.0.1:5173</span>. The engine badge turns connected only after the server answers.</p>
          </li>
        </ol>
        <p className="dialog-note">
          <Terminal size={16} aria-hidden="true" /> Full instructions live in <span className="mono">docs/LOCAL_SETUP.md</span>.
          Free-model access is time-limited and must be verified on your own account.
        </p>
        <div className="dialog-actions">
          <a className="action" href="/workshop">Open the workshop</a>
          <button className="action secondary" type="button" onClick={onClose}>Not now</button>
        </div>
      </div>
    </dialog>
  );
}
