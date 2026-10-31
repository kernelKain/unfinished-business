import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  ChevronDown,
  CircleDollarSign,
  GitFork,
  ListChecks,
  RefreshCw,
  ShieldCheck,
  Square,
  Wrench,
} from "lucide-react";
import type {
  ConnectionStatus,
  DiscoveredModel,
  OpenCodeDiscovery,
  SessionSummary,
  SessionUsage,
} from "../shared/opencode.ts";
import {
  ApiError,
  cancelRun,
  clearRevert,
  commitRevert,
  compactSession,
  findSelectedModel,
  forkSession,
  interruptSession,
  listSessions,
  loadExport,
  loadPermissions,
  loadUsage,
  modelKey,
  replyPermission,
  resumeSession,
  selectModel,
  stageRevert,
  type WorkshopProject,
} from "./api.ts";
import { Diagnostics, formatTokens, modelLabel } from "./onboarding.tsx";

export function OpenCodePanel(props: {
  connection: ConnectionStatus;
  project: WorkshopProject;
  onConnection: (status: ConnectionStatus) => void;
  onProject: (project: WorkshopProject) => void;
  onOpenSetup: () => void;
}) {
  const discovery = props.connection.discovery;
  const selectedModel = findSelectedModel(discovery, props.project.engine.model);
  const [selectedKey, setSelectedKey] = useState(selectedModel?.key ?? "");
  const [variant, setVariant] = useState(props.project.engine.model?.variant ?? "");
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [usage, setUsage] = useState<SessionUsage | null>(null);
  const [permissions, setPermissions] = useState<Array<{ id: string; sessionID: string; action: string; resources: string[]; message: string | null }>>([]);
  const [revertMessages, setRevertMessages] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const chosen = discovery?.models.find((model) => model.key === selectedKey) ?? null;
  const grouped = useMemo(() => {
    const map = new Map<string, DiscoveredModel[]>();
    for (const model of discovery?.models.filter((candidate) => candidate.availability === "available") ?? []) {
      const list = map.get(model.providerID) ?? [];
      list.push(model);
      map.set(model.providerID, list);
    }
    return [...map.entries()];
  }, [discovery]);

  useEffect(() => {
    setSelectedKey(selectedModel?.key ?? "");
    setVariant(props.project.engine.model?.variant ?? "");
  }, [selectedModel?.key, props.project.engine.model?.variant]);

  async function refresh() {
    if (!discovery) return;
    setBusy("refresh");
    setError(null);
    try {
      const [sessionResult, usageResult, permissionResult] = await Promise.all([
        listSessions(),
        loadUsage(),
        loadPermissions(),
      ]);
      setSessions(sessionResult.sessions);
      setUsage(usageResult);
      setPermissions(permissionResult.permissions);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "The OpenCode panel could not refresh.");
    } finally {
      setBusy(null);
    }
  }

  useEffect(() => {
    void refresh();
    // Refresh once when the panel first mounts. Manual refresh avoids noisy polling.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function saveModel() {
    if (!chosen) return;
    setBusy("model");
    setError(null);
    try {
      const result = await selectModel(props.project, {
        providerID: chosen.providerID,
        id: chosen.id,
        variant: variant || null,
      });
      props.onProject(result.project);
      setNote(`Saved ${chosen.providerID}/${chosen.id}${variant ? `#${variant}` : ""}. The next run records this model.`);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "The model could not be saved.");
    } finally {
      setBusy(null);
    }
  }

  async function sessionAction(label: string, work: () => Promise<unknown>) {
    setBusy(label);
    setError(null);
    setNote(null);
    try {
      const result = await work();
      setNote(`${label}: ${typeof result === "string" ? result : JSON.stringify(result)}`);
      await refresh();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : `${label} failed.`);
    } finally {
      setBusy(null);
    }
  }

  async function permissionDecision(request: { id: string; sessionID: string }, decision: "once" | "always" | "reject") {
    await sessionAction("Permission reply", () => replyPermission({
      sessionID: request.sessionID,
      requestID: request.id,
      decision,
    }));
  }

  return (
    <details className="advanced" id="opencode-panel">
      <summary><Wrench size={18} aria-hidden="true" /> OpenCode settings and controls <ChevronDown size={16} aria-hidden="true" /></summary>
      <div className="advanced-body">
        <div className="advanced-head">
          <span className={`state-pill ${props.connection.state}`}>{props.connection.state.replaceAll("_", " ")}</span>
          <span className="meta">
            {props.connection.baseUrl ?? "No URL configured"} · {props.connection.serverVersion ?? "version unknown"} · {props.connection.managed ? "managed by deployment" : "local configuration"}
          </span>
          <button className="action secondary" type="button" disabled={busy !== null} onClick={() => void refresh()}>
            <RefreshCw size={15} aria-hidden="true" /> Refresh
          </button>
          <button className="action secondary" type="button" onClick={props.onOpenSetup}>Connection setup</button>
        </div>

        {error ? <p className="banner bad" role="alert">{error}</p> : null}
        {note ? <p className="banner good" role="status">{note}</p> : null}
        <Diagnostics status={props.connection} />

        <section className="advanced-section">
          <h3><SparkleIcon /> Model and reasoning</h3>
          {discovery ? (
            <>
              <div className="inline-fields">
                <label>
                  Available model
                  <select value={selectedKey} onChange={(event) => { setSelectedKey(event.target.value); setVariant(""); }}>
                    <option value="">Choose a model</option>
                    {grouped.map(([provider, models]) => (
                      <optgroup key={provider} label={provider}>
                        {models?.map((model) => <option key={model.key} value={model.key}>{modelLabel(model)}</option>)}
                      </optgroup>
                    ))}
                  </select>
                </label>
                <label>
                  Variant
                  <select value={variant} onChange={(event) => setVariant(event.target.value)} disabled={!chosen}>
                    <option value="">Model default</option>
                    {(chosen?.variants ?? []).map((id) => <option key={id} value={id}>{id}</option>)}
                  </select>
                </label>
                <button className="action" type="button" disabled={!chosen || busy !== null} onClick={() => void saveModel()}>Save model</button>
              </div>
              {chosen ? (
                <p className="meta">
                  {chosen.pricing === "free" ? "Free" : chosen.pricing === "paid" ? "Paid" : "Price not reported"} · context {formatTokens(chosen.limits.context)} · output {formatTokens(chosen.limits.output)} ·{" "}
                  {chosen.tools ? "tools supported" : "no tool support"} · {chosen.modalities.input.join("/")} input · {chosen.local ? "local provider" : "remote/unknown locality"}
                </p>
              ) : null}
              <p className="note">Only variants returned for the chosen model appear here. Model changes take effect on the next run; an in-flight session keeps its own model.</p>
            </>
          ) : <p className="note">Connection discovery is unavailable. Reconnect to inspect models.</p>}
        </section>

        <section className="advanced-section">
          <h3><ShieldCheck size={17} aria-hidden="true" /> Agents, roles, and permissions</h3>
          {discovery ? (
            <>
              <ul className="compact-list">
                {discovery.roles.map((role) => (
                  <li key={role.role}><strong>{role.role}</strong> → {role.agent}{role.available ? "" : " (fallback/unavailable)"}<span className="meta"> {role.detail}</span></li>
                ))}
              </ul>
              <p className="meta">Visible OpenCode agents: {discovery.agents.map((agent) => `${agent.name} (${agent.mode})`).join(", ") || "none reported"}</p>
              <h4>Pending permission requests</h4>
              {permissions.length === 0 ? <p className="note">No pending request is reported for this project.</p> : (
                <ul className="permission-list">
                  {permissions.map((request) => (
                    <li key={request.id}>
                      <span><strong>{request.action}</strong> {request.resources.join(", ")}{request.message ? ` — ${request.message}` : ""}</span>
                      <span className="permission-actions">
                        <button type="button" disabled={busy !== null} onClick={() => void permissionDecision(request, "once")}>Allow once</button>
                        <button type="button" disabled={busy !== null} onClick={() => void permissionDecision(request, "always")}>Always</button>
                        <button type="button" className="danger" disabled={busy !== null} onClick={() => void permissionDecision(request, "reject")}>Reject</button>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <p className="note">Replies are sent to OpenCode for a request owned by this project. Unfinished Business never auto-approves a request.</p>
            </>
          ) : null}
        </section>

        <section className="advanced-section">
          <h3><ListChecks size={17} aria-hidden="true" /> Discovered harness capabilities</h3>
          {discovery ? (
            <>
              <ul className="capability-grid">
                {discovery.capabilities.map((capability) => (
                  <li key={capability.id} className={capability.supported ? "supported" : "deferred"}>
                    <strong>{capability.label}</strong>
                    <span>{capability.supported ? "supported" : "deferred"}</span>
                    <span className="meta">{capability.detail}</span>
                  </li>
                ))}
              </ul>
              <div className="discovery-columns">
                <div><h4>Commands</h4><p className="meta">{discovery.commands.map((command) => `/${command.name}${command.description ? ` — ${command.description}` : ""}`).join(" · ") || "none"}</p></div>
                <div><h4>Skills</h4><p className="meta">{discovery.skills.map((skill) => skill.name).join(", ") || "none"}</p></div>
                <div><h4>MCP servers</h4><p className="meta">{discovery.mcpServers.map((server) => `${server.name}: ${server.status}`).join(" · ") || "none"}</p></div>
                <div><h4>Formatters / LSP</h4><p className="meta">{discovery.formatters.map((item) => item.name).join(", ") || "no formatter config"} · {discovery.lspServers.map((item) => item.name).join(", ") || "no LSP config"}</p></div>
              </div>
            </>
          ) : null}
        </section>

        <section className="advanced-section">
          <h3><CircleDollarSign size={17} aria-hidden="true" /> Usage, tokens, and cost</h3>
          {usage?.supported ? (
            <p className="meta">
              {usage.sessions.length} session(s) · cost {usage.totals.cost.toFixed(4)} USD · input {usage.totals.tokens.input} · output {usage.totals.tokens.output} · reasoning {usage.totals.tokens.reasoning}
            </p>
          ) : <p className="note">OpenCode has not reported usage for a project-owned session yet. Usage is shown only when the provider returns it.</p>}
          <p className="note">Quota and balance are not available from the OpenCode HTTP API. {usage?.detail}</p>
          <p className="meta">
            {usage?.links.length ? usage.links.map((link) => <a key={link.url} href={link.url} target="_blank" rel="noreferrer">{link.label}</a>) : "No provider usage link is known for this catalog."}
          </p>
        </section>

        <section className="advanced-section">
          <h3><Activity size={17} aria-hidden="true" /> Project sessions</h3>
          <p className="note">Only sessions referenced by this project are listed. Actions are checked against that ownership before they reach OpenCode.</p>
          {sessions.length === 0 ? <p className="note">No session has been created for this project yet.</p> : (
            <ul className="session-list">
              {sessions.map((session) => (
                <li key={session.id}>
                  <div>
                    <strong>{session.role}</strong> <span className="meta">{session.id} · {session.title ?? "untitled"} · {session.model ?? "model not reported"}</span>
                    <p className="meta">
                      {session.messageCount} message(s) · {session.outcome ?? "outcome unknown"} · cost {session.cost.toFixed(4)} · {session.idle ? "idle" : "possibly active"}
                    </p>
                  </div>
                  <div className="session-actions">
                    <button type="button" disabled={busy !== null} onClick={() => void sessionAction("Resume", () => resumeSession(session.id))}>Open</button>
                    <button type="button" disabled={busy !== null || session.messageCount === 0} onClick={() => void sessionAction("Fork", () => forkSession(session.id))}><GitFork size={13} aria-hidden="true" /> Fork</button>
                    <button type="button" disabled={busy !== null} onClick={() => void sessionAction("Compact", () => compactSession(session.id))}>Compact</button>
                    <button type="button" className="danger" disabled={busy !== null} onClick={() => void sessionAction("Interrupt", () => interruptSession(session.id))}><Square size={12} aria-hidden="true" /> Interrupt</button>
                  </div>
                  <div className="revert-controls">
                    <input
                      aria-label={`Message ID for ${session.id}`}
                      placeholder="message ID to revert before"
                      value={revertMessages[session.id] ?? ""}
                      onChange={(event) => setRevertMessages((current) => ({ ...current, [session.id]: event.target.value }))}
                    />
                    <button type="button" disabled={busy !== null || !(revertMessages[session.id] ?? "").trim()} onClick={() => void sessionAction("Stage revert", () => stageRevert(session.id, revertMessages[session.id].trim()))}>Stage revert</button>
                    <button type="button" disabled={busy !== null} onClick={() => void sessionAction("Clear revert", () => clearRevert(session.id))}>Clear</button>
                    <button type="button" className="danger" disabled={busy !== null} onClick={() => void sessionAction("Commit revert", () => commitRevert(session.id))}>Commit revert</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {props.project.operations.some((operation) => operation.status === "RUNNING" || operation.status === "QUEUED") ? (
            <div className="inline-fields">
              {props.project.operations.filter((operation) => operation.status === "RUNNING" || operation.status === "QUEUED").map((operation) => (
                <button key={operation.id} className="action secondary" type="button" disabled={busy !== null} onClick={() => void sessionAction("Cancel run", () => cancelRun(props.project, operation.id))}>
                  Cancel {operation.kind} run
                </button>
              ))}
            </div>
          ) : null}
        </section>

        <section className="advanced-section">
          <h3><Activity size={17} aria-hidden="true" /> Export check</h3>
          <button className="action secondary" type="button" disabled={busy !== null} onClick={() => void sessionAction("Export check", async () => {
            const exported = await loadExport();
            return `${exported.limitation} ${exported.plan ? "Compiled plan is ready." : "Plan is not fully approved."} Engine: ${modelKey(exported.engine.model) ?? "no model selected"}.`;
          })}>Check export</button>
        </section>
      </div>
    </details>
  );
}

function SparkleIcon() {
  return <span aria-hidden="true">✦</span>;
}
