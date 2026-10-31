import { useRef, useState } from "react";
import { Check, Copy } from "lucide-react";
import { setupTabs } from "../setup.ts";

export function SetupCommandTabs({ initial = "install" }: { initial?: string }) {
  const initialIndex = Math.max(0, setupTabs.findIndex((tab) => tab.id === initial));
  const [active, setActive] = useState(initialIndex);
  const [copied, setCopied] = useState(false);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const tab = setupTabs[active];

  function select(index: number) {
    const next = (index + setupTabs.length) % setupTabs.length;
    setActive(next);
    setCopied(false);
    tabRefs.current[next]?.focus();
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      select(active + 1);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      select(active - 1);
    } else if (event.key === "Home") {
      event.preventDefault();
      select(0);
    } else if (event.key === "End") {
      event.preventDefault();
      select(setupTabs.length - 1);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(tab.command);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2_000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="setup-tabs" data-testid="setup-tabs">
      <div className="setup-tablist" role="tablist" aria-label="Local setup commands" onKeyDown={onKeyDown}>
        {setupTabs.map((item, index) => (
          <button
            key={item.id}
            ref={(element) => { tabRefs.current[index] = element; }}
            id={`setup-tab-${item.id}`}
            className="setup-tab"
            type="button"
            role="tab"
            aria-selected={index === active}
            aria-controls="setup-panel"
            tabIndex={index === active ? 0 : -1}
            onClick={() => select(index)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div
        id="setup-panel"
        className="setup-panel"
        role="tabpanel"
        aria-labelledby={`setup-tab-${tab.id}`}
        tabIndex={0}
      >
        <div className="setup-panel-head">
          <div>
            <p className="eyebrow">Step {active + 1} of {setupTabs.length}</p>
            <h3>{tab.title}</h3>
          </div>
          <button className="copy-button" type="button" onClick={() => void copy()} aria-label={copied ? "Copied" : "Copy command"}>
            {copied ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
            <span>{copied ? "Copied" : "Copy"}</span>
          </button>
        </div>
        <pre className="command-block"><code>{tab.command}</code></pre>
        <p className="setup-note">{tab.note}</p>
      </div>
      <p className="setup-source">
        Commands are checked against <span className="mono">docs/LOCAL_SETUP.md</span> and the repository scripts.
      </p>
    </div>
  );
}
