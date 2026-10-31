import { AlertTriangle, RefreshCw, Settings2 } from "lucide-react";
import type { ProviderErrorDetails } from "../../shared/workflow.ts";

export function ProviderErrorCard(props: {
  error: ProviderErrorDetails;
  onChangeModel: () => void;
  onDismiss: () => void;
}) {
  const needsSettings = props.error.action !== "retry";
  return (
    <section
      className="provider-error-card"
      role="alert"
      aria-labelledby="provider-error-title"
      data-category={props.error.category}
      data-saved-work={props.error.savedWorkChanged}
    >
      <div className="provider-error-heading">
        <AlertTriangle size={20} aria-hidden="true" />
        <div>
          <p className="eyebrow">{props.error.category.replaceAll("_", " ")}</p>
          <h2 id="provider-error-title">Provider request needs attention</h2>
        </div>
      </div>
      <dl>
        <div><dt>What happened</dt><dd>{props.error.whatHappened}</dd></div>
        <div><dt>Saved work</dt><dd>{props.error.savedWorkMessage}</dd></div>
        <div><dt>Recommended repair</dt><dd>{props.error.repair}</dd></div>
      </dl>
      <div className="actions">
        <button className="action" type="button" onClick={needsSettings ? props.onChangeModel : props.onDismiss}>
          {needsSettings ? <Settings2 size={15} aria-hidden="true" /> : <RefreshCw size={15} aria-hidden="true" />}
          {needsSettings ? "Review provider or model" : "Dismiss; retry when ready"}
        </button>
        {needsSettings ? (
          <button className="action ghost" type="button" onClick={props.onDismiss}>Dismiss</button>
        ) : (
          <button className="action secondary" type="button" onClick={props.onChangeModel}>Change model</button>
        )}
      </div>
      <details>
        <summary>Technical details</summary>
        <dl className="technical-details">
          <div><dt>Provider</dt><dd>{props.error.technical.provider}</dd></div>
          <div><dt>Status</dt><dd>{props.error.technical.statusCode ?? "not reported"}</dd></div>
          <div><dt>Provider code</dt><dd>{props.error.technical.providerCode ?? "not reported"}</dd></div>
          <div><dt>Session</dt><dd>{props.error.technical.sessionReference ?? "not created or not reported"}</dd></div>
          <div><dt>Diagnostic reference</dt><dd>{props.error.technical.diagnosticReference}</dd></div>
          <div><dt>Safe detail</dt><dd>{props.error.technical.safeDetail}</dd></div>
        </dl>
      </details>
    </section>
  );
}
