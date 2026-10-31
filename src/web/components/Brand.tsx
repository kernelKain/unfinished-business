export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <a className="brand" href="/" aria-label="Unfinished Business — home">
      <svg className="brand-mark" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
        <path className="brand-mark-frame" d="M14 12h20l-2 23H16z" />
        <path className="brand-mark-glint" d="M19 17h10l-1 12h-8z" />
        <circle className="brand-mark-flame" cx="24" cy="24" r="3.2" />
        <path className="brand-mark-hook" d="M24 4v6" />
        <circle cx="10" cy="34" r="1.4" className="brand-mark-mote" />
        <circle cx="38" cy="19" r="1" className="brand-mark-mote" />
        <circle cx="36" cy="38" r="1.7" className="brand-mark-mote" />
      </svg>
      <span className="brand-type">
        <span className="brand-name">Unfinished Business</span>
        {compact ? null : <span className="brand-tag">Ghostlight Hacker Workshop</span>}
      </span>
    </a>
  );
}
