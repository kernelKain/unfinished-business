import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, KeyRound, LockKeyhole, PlugZap, Server, Sparkles } from "lucide-react";
import type { ConnectionStatus, DiscoveredModel, OpenCodeDiscovery } from "../shared/opencode.ts";
import {
  ApiError,
  checkConnection,
  configureConnection,
  selectModel,
  type WorkshopProject,
} from "./api.ts";

export function formatTokens(value: number | null): string {
  if (value === null) return "not reported";
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${Math.round(value / 1_000)}k`;
  return String(value);
}

export function modelLabel(model: DiscoveredModel): string {
  return `${model.name} — ${model.providerID}/${model.id}`;
}

function pricingLabel(model: DiscoveredModel): string {
  if (model.pricing === "free") return "Free";
  if (model.pricing === "paid") return "Paid";
  return "Price not reported";
}

function statusCopy(state: ConnectionStatus["state"]): { title: string; detail: string; tone: string } {
  switch (state) {
    case "connected":
      return { title: "OpenCode is connected", detail: "The server and catalog answered. No model call was made.", tone: "good" };
    case "degraded":
      return { title: "Connected with warnings", detail: "OpenCode answered, but some capability or provider checks need attention.", tone: "warn" };
    case "authentication_required":
      return { title: "Authentication required", detail: "OpenCode rejected the application connection. Enter the server password, not a provider API key.", tone: "bad" };
    case "incompatible_version":
      return { title: "Unsupported OpenCode version", detail: "This build is tested against the 2.x HTTP surface. Install a compatible server before continuing.", tone: "bad" };
    case "unavailable":
      return { title: "OpenCode is unavailable", detail: "The server did not answer. Start it and retry; nothing was inferred.", tone: "bad" };
    case "checking":
      return { title: "Checking OpenCode", detail: "A read-only connection and discovery check is running.", tone: "warn" };
    default:
      return { title: "Connect OpenCode", detail: "Point this workshop at a running OpenCode server. Provider credentials stay inside OpenCode.", tone: "warn" };
  }
}

export function Onboarding(props: {
  connection: ConnectionStatus;
  project: WorkshopProject;
  onConnection: (status: ConnectionStatus) => void;
  onProject: (project: WorkshopProject) => void;
  onClose?: () => void;
  firstRun: boolean;
}) {
  const selected = props.project.engine.model;
  const selectedModel = useMemo(
    () => props.connection.discovery?.models.find((model) => model.providerID === selected?.providerID && model.id === selected?.id) ?? null,
    [props.connection.discovery, selected],
  );
  const [phase, setPhase] = useState<"connect" | "model">(props.connection.discovery ? "model" : "connect");
  const [baseUrl, setBaseUrl] = useState(props.connection.baseUrl ?? "http://127.0.0.1:4096");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selectedKey = selected ? `${selected.providerID}/${selected.id}` : "";
  const selectedIsAvailable = props.connection.discovery?.models.some((model) => model.key === selectedKey && model.availability === "available") ?? false;
  const [chosenKey, setChosenKey] = useState(
    selectedIsAvailable ? selectedKey : props.connection.discovery?.models.find((model) => model.availability === "available" && model.pricing === "free" && model.tools)?.key
      ?? props.connection.discovery?.models.find((model) => model.availability === "available")?.key
      ?? "",
  );
  const [variant, setVariant] = useState(selected?.variant ?? "");
  const copy = statusCopy(props.connection.state);
  const discovery = props.connection.discovery;
  const chosen = discovery?.models.find((model) => model.key === chosenKey) ?? null;

  async function connect() {
    setBusy(true);
    setError(null);
    try {
      const status = props.connection.managed
        ? await checkConnection()
        : await configureConnection({
            baseUrl: baseUrl.trim(),
            username: "opencode",
            ...(password ? { password } : {}),
          });
      props.onConnection(status);
      if (status.discovery) {
        setPhase("model");
        const preferred = status.discovery.models.find((model) => model.availability === "available" && model.pricing === "free" && model.tools)
          ?? status.discovery.models.find((model) => model.availability === "available");
        if (preferred) {
          setChosenKey(preferred.key);
          setVariant("");
        }
      }
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "The connection check failed.");
    } finally {
      setBusy(false);
    }
  }

  async function finish() {
    if (!chosen) return;
    setBusy(true);
    setError(null);
    try {
      const result = await selectModel(props.project, {
        providerID: chosen.providerID,
        id: chosen.id,
        variant: variant || null,
      });
      props.onProject(result.project);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "The model selection could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="onboarding" aria-labelledby="onboarding-title">
      <div className="onboarding-head">
        <div>
          <p className="eyebrow">First run</p>
          <h1 id="onboarding-title">Connect your OpenCode workshop</h1>
          <p className="status-line">
            Start OpenCode yourself, then connect this app to it. Unfinished Business never asks for provider API keys and
            never stores them in the browser.
          </p>
        </div>
        {props.onClose ? (
          <button className="action secondary" type="button" onClick={props.onClose}>
            {props.firstRun ? "Continue to workshop" : "Close"}
          </button>
        ) : null}
      </div>

      <ol className="wizard-steps" aria-label="Setup steps">
        <li className={phase === "connect" ? "current" : "done"}><Server size={16} aria-hidden="true" /> Server</li>
        <li className={phase === "model" ? "current" : ""}><Sparkles size={16} aria-hidden="true" /> Model</li>
        <li><CheckCircle2 size={16} aria-hidden="true" /> Verify</li>
      </ol>

      {phase === "connect" ? (
        <div className="wizard-grid">
          <div className="wizard-card">
            <h2><PlugZap size={20} aria-hidden="true" /> 1. Start OpenCode</h2>
            <p>In a terminal on the machine that will run the workshop:</p>
            <pre className="command">opencode serve --hostname 127.0.0.1 --port 4096</pre>
            <p className="note">
              OpenCode prints a server password. The app uses it for its own Basic-auth connection. It is held in this
              process only and is never written to project JSON, browser storage, logs, or Sentry.
            </p>
            <p className="note">
              Provider accounts are connected inside OpenCode with <code>/connect</code>, then a model is chosen with{" "}
              <code>/models</code>. Those keys remain in OpenCode&apos;s credential store.
            </p>
            {props.connection.managed ? (
              <p className="banner">This deployment manages the URL and credentials through its environment and secret store. Retry the managed connection instead.</p>
            ) : null}
            <div className="wizard-actions">
              <button className="action" type="button" disabled={busy} onClick={() => void connect()}>
                {busy ? "Checking…" : props.connection.managed ? "Retry managed connection" : "Test connection"}
              </button>
            </div>
          </div>

          <div className="wizard-card">
            <h2><LockKeyhole size={20} aria-hidden="true" /> 2. Connection details</h2>
            <label>
              OpenCode server URL
              <input
                type="url"
                value={baseUrl}
                onChange={(event) => setBaseUrl(event.target.value)}
                placeholder="http://127.0.0.1:4096"
                disabled={props.connection.managed}
                autoComplete="off"
              />
            </label>
            <p className="note">Loopback HTTP is allowed locally. A remote server must use HTTPS. Credentials in the URL are rejected.</p>
            <p className="meta">Basic-auth username: <code>opencode</code> (fixed by the OpenCode server).</p>
            <label>
              OpenCode server password
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder={props.connection.auth.hasPassword ? "Password already held in this process" : "Paste the password printed by opencode serve"}
                disabled={props.connection.managed}
                autoComplete="current-password"
              />
            </label>
            <p className="note"><KeyRound size={14} aria-hidden="true" /> This is the OpenCode server password, not an OpenAI/Anthropic/etc. API key. Provider keys are rejected by this API.</p>
          </div>
        </div>
      ) : (
        <div className="wizard-card">
          <h2><Sparkles size={20} aria-hidden="true" /> 3. Choose a model</h2>
          {discovery ? <DiscoverySummary discovery={discovery} /> : null}
          <div className="model-list" role="radiogroup" aria-label="Available models">
            {(discovery?.models ?? []).filter((model) => model.availability === "available").map((model) => (
              <label key={model.key} className={model.key === chosenKey ? "model-option selected" : "model-option"}>
                <input
                  type="radio"
                  name="model"
                  value={model.key}
                  checked={model.key === chosenKey}
                  onChange={() => {
                    setChosenKey(model.key);
                    setVariant("");
                  }}
                />
                <span>
                  <strong>{model.name}</strong>
                  <span className="meta">{model.providerID}/{model.id}</span>
                  <span className="model-facts">
                    {pricingLabel(model)} · {formatTokens(model.limits.context)} context · {formatTokens(model.limits.output)} output ·{" "}
                    {model.tools ? "tools" : "no tools"} · {model.modalities.input.join("/")} input
                    {model.local ? " · local" : ""}
                  </span>
                  {model.reasoning.supported ? (
                    <span className="meta">Reasoning: {model.reasoning.source === "variants" ? "model-reported variants" : "provider compatibility"}</span>
                  ) : null}
                </span>
              </label>
            ))}
          </div>
          {chosen ? (
            <div className="model-detail">
              <p><strong>{modelLabel(chosen)}</strong></p>
              <p className="meta">
                {pricingLabel(chosen)} · context {formatTokens(chosen.limits.context)} · input {formatTokens(chosen.limits.input)} · output {formatTokens(chosen.limits.output)}
              </p>
              <label>
                Variant
                <select value={variant} onChange={(event) => setVariant(event.target.value)}>
                  <option value="">Model default</option>
                  {chosen.variants.map((id) => <option key={id} value={id}>{id}</option>)}
                </select>
              </label>
              <p className="note">Only variants reported for this model are listed. There is no universal low/medium/high scale.</p>
            </div>
          ) : (
            <p className="banner bad">No available model is reported. Connect a provider inside OpenCode, then retry discovery.</p>
          )}
          <div className="wizard-actions">
            <button className="action secondary" type="button" onClick={() => setPhase("connect")}>Back</button>
            <button className="action" type="button" disabled={!chosen || busy} onClick={() => void finish()}>
              {busy ? "Saving…" : "Use this model"}
            </button>
          </div>
        </div>
      )}

      {error ? <p className="banner bad" role="alert">{error}</p> : null}
      {props.connection.checkedAt || props.connection.diagnostics.length ? (
        <div className={`connection-summary ${copy.tone}`}>
          <p><strong>{copy.title}</strong> <span className="meta">{copy.detail}</span></p>
          {props.connection.serverVersion ? <p className="meta">Server {props.connection.serverVersion} · checked {new Date(props.connection.checkedAt ?? Date.now()).toLocaleString()}</p> : null}
          <Diagnostics status={props.connection} />
        </div>
      ) : null}
      {selectedModel ? <p className="note">Current selection: {modelLabel(selectedModel)}{selected?.variant ? ` · variant ${selected.variant}` : " · model default"}</p> : null}
    </section>
  );
}

function DiscoverySummary({ discovery }: { discovery: OpenCodeDiscovery }) {
  return (
    <div className="discovery-summary">
      <p className="note">
        OpenCode {discovery.server.version} · {discovery.models.length} model(s) · {discovery.providers.length} provider(s) ·{" "}
        {discovery.agents.length} agent(s)
      </p>
      {discovery.providers.map((provider) => (
        <p key={provider.id} className={provider.ready === "ready" ? "meta" : "meta warn-text"}>
          {provider.name}: {provider.ready === "ready" ? "ready" : provider.ready === "needs_auth" ? "needs OpenCode authentication" : "availability inferred"} — {provider.detail}
        </p>
      ))}
    </div>
  );
}

export function Diagnostics({ status }: { status: ConnectionStatus }) {
  if (status.diagnostics.length === 0) return <p className="note good-text"><CheckCircle2 size={14} aria-hidden="true" /> No connection issues were reported.</p>;
  return (
    <ul className="diagnostics">
      {status.diagnostics.map((diagnostic) => (
        <li key={`${diagnostic.code}-${diagnostic.message}`} className={diagnostic.severity}>
          <AlertTriangle size={15} aria-hidden="true" />
          <span>
            <strong>{diagnostic.title}</strong>
            <span>{diagnostic.message}</span>
            <span className="repair">Repair: {diagnostic.repair}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
