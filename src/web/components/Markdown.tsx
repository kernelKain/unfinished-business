import { Fragment, type ReactNode } from "react";
import {
  parseMarkdown,
  safeHref,
  type MarkdownBlock,
  type MarkdownInline,
} from "../../shared/markdown.ts";

function inline(nodes: MarkdownInline[], keyPrefix = "i"): ReactNode[] {
  return nodes.map((node, index) => {
    const key = `${keyPrefix}-${index}`;
    if (node.type === "text") return <Fragment key={key}>{node.value}</Fragment>;
    if (node.type === "break") return <br key={key} />;
    if (node.type === "code") return <code key={key}>{node.value}</code>;
    if (node.type === "strong") return <strong key={key}>{inline(node.children, key)}</strong>;
    if (node.type === "em") return <em key={key}>{inline(node.children, key)}</em>;
    if (node.type === "strike") return <del key={key}>{inline(node.children, key)}</del>;
    if (node.type === "link") {
      const href = safeHref(node.href);
      return href
        ? <a key={key} href={href} target="_blank" rel="noreferrer noopener">{inline(node.children, key)}</a>
        : <span key={key}>{inline(node.children, key)}</span>;
    }
    return null;
  });
}

function listItems(
  items: Array<{ depth: number; text: string; children: MarkdownInline[] }>,
  ordered: boolean,
  keyPrefix: string,
): ReactNode {
  const render = (start: number, depth: number, prefix: string): { nodes: ReactNode; next: number } => {
    const nodes: ReactNode[] = [];
    let index = start;
    while (index < items.length) {
      const item = items[index];
      if (item.depth < depth) break;
      if (item.depth > depth) {
        const nested = render(index, item.depth, `${prefix}-n${index}`);
        nodes.push(nested.nodes);
        index = nested.next;
        continue;
      }
      const children: ReactNode[] = [<Fragment key={`${prefix}-t${index}`}>{inline(item.children, `${prefix}-${index}`)}</Fragment>];
      let next = index + 1;
      if (next < items.length && items[next].depth > depth) {
        const nested = render(next, items[next].depth, `${prefix}-n${index}`);
        children.push(nested.nodes);
        next = nested.next;
      }
      nodes.push(<li key={`${prefix}-${index}`}>{children}</li>);
      index = next;
    }
    return {
      nodes: ordered ? <ol key={prefix}>{nodes}</ol> : <ul key={prefix}>{nodes}</ul>,
      next: index,
    };
  };
  return render(0, items[0]?.depth ?? 0, keyPrefix).nodes;
}

function renderBlock(block: MarkdownBlock, index: number): ReactNode {
  const key = `b-${index}`;
  if (block.type === "heading") {
    const Tag = `h${Math.min(6, Math.max(1, block.level))}` as "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
    return <Tag key={key}>{inline(block.children, key)}</Tag>;
  }
  if (block.type === "paragraph") return <p key={key}>{inline(block.children, key)}</p>;
  if (block.type === "list") return <Fragment key={key}>{listItems(block.items, block.ordered, key)}</Fragment>;
  if (block.type === "code") {
    const language = block.language?.replace(/[^A-Za-z0-9_+-]/g, "") || undefined;
    return (
      <pre key={key} className="markdown-code">
        <code className={language ? `language-${language}` : undefined}>{block.code}</code>
      </pre>
    );
  }
  if (block.type === "table") {
    return (
      <div key={key} className="markdown-table-wrap">
        <table>
          <thead>
            <tr>{block.header.map((cell, cellIndex) => <th key={`${key}-h${cellIndex}`}>{cell}</th>)}</tr>
          </thead>
          <tbody>
            {block.rows.map((row, rowIndex) => (
              <tr key={`${key}-r${rowIndex}`}>
                {block.header.map((_cell, cellIndex) => <td key={`${key}-r${rowIndex}-c${cellIndex}`}>{row[cellIndex] ?? ""}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  if (block.type === "blockquote") return <blockquote key={key}>{inline(block.children, key)}</blockquote>;
  if (block.type === "hr") return <hr key={key} />;
  return null;
}

/**
 * Safe Markdown renderer. No block is ever interpreted as HTML and links are
 * filtered through safeHref, so generated content cannot execute script.
 */
export function Markdown({ content, className = "" }: { content: string; className?: string }) {
  const blocks = parseMarkdown(content);
  if (!blocks.length) return null;
  return <div className={`markdown ${className}`.trim()}>{blocks.map(renderBlock)}</div>;
}
