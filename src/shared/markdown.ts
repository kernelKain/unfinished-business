/**
 * A deliberately small, safe Markdown subset.
 *
 * The renderer never interprets raw HTML. Every text node is rendered by
 * React (which escapes it), and links are only emitted for http, https, and
 * mailto targets. The parser is shared with section-contract validation so a
 * candidate is judged against the same blocks the user will read.
 */

export type MarkdownInline =
  | { type: "text"; value: string }
  | { type: "strong"; children: MarkdownInline[] }
  | { type: "em"; children: MarkdownInline[] }
  | { type: "strike"; children: MarkdownInline[] }
  | { type: "code"; value: string }
  | { type: "link"; href: string; children: MarkdownInline[] }
  | { type: "break" };

export type MarkdownBlock =
  | { type: "heading"; level: number; text: string; children: MarkdownInline[] }
  | { type: "paragraph"; text: string; children: MarkdownInline[] }
  | { type: "list"; ordered: boolean; items: Array<{ depth: number; text: string; children: MarkdownInline[] }> }
  | { type: "code"; language: string | null; code: string }
  | { type: "table"; header: string[]; rows: string[][] }
  | { type: "blockquote"; text: string; children: MarkdownInline[] }
  | { type: "hr" };

const CONTROL_CHARACTERS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g;

function findLinkEnd(text: string, start: number): number {
  let depth = 0;
  for (let index = start; index < text.length; index += 1) {
    if (text[index] === "(") depth += 1;
    else if (text[index] === ")") {
      if (depth === 0) return index;
      depth -= 1;
    }
  }
  return -1;
}

function unsafeProtocol(value: string): boolean {
  return /^(?:javascript|data|vbscript|file):/i.test(value.trim());
}

/** Replaces an unsafe Markdown link with its visible label. */
function stripUnsafeMarkdownLinks(input: string): string {
  let output = "";
  let index = 0;
  while (index < input.length) {
    if (input[index] === "[") {
      const labelEnd = input.indexOf("]", index + 1);
      if (labelEnd > index && input[labelEnd + 1] === "(") {
        const hrefEnd = findLinkEnd(input, labelEnd + 2);
        if (hrefEnd > labelEnd + 2) {
          const href = input.slice(labelEnd + 2, hrefEnd);
          if (unsafeProtocol(href)) {
            output += input.slice(index + 1, labelEnd);
            index = hrefEnd + 1;
            continue;
          }
        }
      }
    }
    output += input[index];
    index += 1;
  }
  return output;
}

/**
 * Removes content that must never be stored or executed. Raw HTML other than
 * script/style remains literal text; the renderer escapes it.
 */
export function sanitizeGeneratedMarkdown(input: string): string {
  const cleaned = input
    .replace(/\r\n?/g, "\n")
    .replace(CONTROL_CHARACTERS, "")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "[removed script]")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "[removed style]");
  return stripUnsafeMarkdownLinks(cleaned).slice(0, 24_000);
}

/** Only these link targets are emitted; anything else renders as text. */
export function safeHref(raw: string): string | null {
  const value = raw.trim();
  if (!value || value.length > 2_048) return null;
  if (/[\u0000-\u001f\s]/.test(value)) return null;
  if (value.startsWith("//")) return null;
  let parsed: URL;
  try {
    parsed = new URL(value, "https://unfinished-business.invalid/");
  } catch {
    return null;
  }
  if (!["http:", "https:", "mailto:"].includes(parsed.protocol)) return null;
  return value;
}

function isBlank(line: string): boolean {
  return line.trim().length === 0;
}

function headingMatch(line: string): RegExpMatchArray | null {
  return line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);
}

function fenceMatch(line: string): RegExpMatchArray | null {
  return line.match(/^\s*(```+|~~~+)\s*([A-Za-z0-9_+-]*)\s*$/);
}

function listMatch(line: string): { ordered: boolean; depth: number; text: string } | null {
  const match = line.match(/^(\s*)([-*+]|\d+[.)])\s+(.*)$/);
  if (!match) return null;
  return {
    ordered: /^\d/.test(match[2]),
    depth: Math.min(6, Math.floor(match[1].replace(/\t/g, "  ").length / 2)),
    text: match[3],
  };
}

function tableSeparator(line: string): boolean {
  const cells = splitTableRow(line);
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell.trim()));
}

function splitTableRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split(/(?<!\\)\|/)
    .map((cell) => cell.trim().replace(/\\\|/g, "|"));
}

function findClosing(text: string, token: string, from: number): number {
  return text.indexOf(token, from);
}

/** Parses inline emphasis, code spans, and safe links. Raw HTML stays text. */
export function parseInline(text: string): MarkdownInline[] {
  const nodes: MarkdownInline[] = [];
  let buffer = "";
  let index = 0;

  const flush = () => {
    if (buffer) {
      nodes.push({ type: "text", value: buffer });
      buffer = "";
    }
  };

  while (index < text.length) {
    const character = text[index];
    if (character === "\n") {
      flush();
      nodes.push({ type: "break" });
      index += 1;
      continue;
    }
    if (character === "`") {
      const close = findClosing(text, "`", index + 1);
      if (close > index + 1) {
        flush();
        nodes.push({ type: "code", value: text.slice(index + 1, close) });
        index = close + 1;
        continue;
      }
    }
    if (text.startsWith("**", index) || text.startsWith("__", index)) {
      const token = text.slice(index, index + 2);
      const close = findClosing(text, token, index + 2);
      if (close > index + 2) {
        flush();
        nodes.push({ type: "strong", children: parseInline(text.slice(index + 2, close)) });
        index = close + 2;
        continue;
      }
    }
    if (text.startsWith("~~", index)) {
      const close = findClosing(text, "~~", index + 2);
      if (close > index + 2) {
        flush();
        nodes.push({ type: "strike", children: parseInline(text.slice(index + 2, close)) });
        index = close + 2;
        continue;
      }
    }
    if (character === "*" || character === "_") {
      const close = findClosing(text, character, index + 1);
      if (close > index + 1) {
        flush();
        nodes.push({ type: "em", children: parseInline(text.slice(index + 1, close)) });
        index = close + 1;
        continue;
      }
    }
    if (character === "[") {
      const labelEnd = text.indexOf("]", index + 1);
      const isLink = labelEnd > index + 1 && text[labelEnd + 1] === "(";
      const hrefEnd = isLink ? findLinkEnd(text, labelEnd + 2) : -1;
      if (isLink && hrefEnd > labelEnd + 2) {
        const label = text.slice(index + 1, labelEnd);
        const href = safeHref(text.slice(labelEnd + 2, hrefEnd));
        flush();
        if (href) nodes.push({ type: "link", href, children: parseInline(label) });
        else nodes.push({ type: "text", value: label });
        index = hrefEnd + 1;
        continue;
      }
    }
    buffer += character;
    index += 1;
  }
  flush();
  return nodes;
}

/** Parses the supported Markdown subset into deterministic blocks. */
export function parseMarkdown(source: string): MarkdownBlock[] {
  const lines = sanitizeGeneratedMarkdown(source).split("\n");
  const blocks: MarkdownBlock[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    if (isBlank(line)) {
      index += 1;
      continue;
    }

    const fence = fenceMatch(line);
    if (fence) {
      const marker = fence[1][0];
      const language = fence[2] || null;
      const code: string[] = [];
      index += 1;
      while (index < lines.length) {
        const candidate = lines[index];
        if (new RegExp(`^\\s*${marker}{3,}\\s*$`).test(candidate)) {
          index += 1;
          break;
        }
        code.push(candidate);
        index += 1;
      }
      blocks.push({ type: "code", language, code: code.join("\n") });
      continue;
    }

    const heading = headingMatch(line);
    if (heading) {
      const text = heading[2].trim();
      blocks.push({ type: "heading", level: heading[1].length, text, children: parseInline(text) });
      index += 1;
      continue;
    }

    if (/^\s*([-*_])\s*\1\s*\1[\s\S]*$/.test(line) && !listMatch(line)) {
      blocks.push({ type: "hr" });
      index += 1;
      continue;
    }

    if (/^\s*>/.test(line)) {
      const quoted: string[] = [];
      while (index < lines.length && /^\s*>/.test(lines[index])) {
        quoted.push(lines[index].replace(/^\s*>\s?/, ""));
        index += 1;
      }
      const text = quoted.join("\n");
      blocks.push({ type: "blockquote", text, children: parseInline(text) });
      continue;
    }

    const list = listMatch(line);
    if (list) {
      const items: Array<{ depth: number; text: string; children: MarkdownInline[] }> = [];
      let ordered = list.ordered;
      while (index < lines.length) {
        const current = listMatch(lines[index]);
        if (!current) {
          if (isBlank(lines[index])) break;
          if (items.length && /^\s{2,}\S/.test(lines[index])) {
            items[items.length - 1].text += ` ${lines[index].trim()}`;
            items[items.length - 1].children = parseInline(items[items.length - 1].text);
            index += 1;
            continue;
          }
          break;
        }
        if (!items.length) ordered = current.ordered;
        items.push({ depth: current.depth, text: current.text, children: parseInline(current.text) });
        index += 1;
      }
      blocks.push({ type: "list", ordered, items });
      continue;
    }

    if (line.includes("|") && index + 1 < lines.length && tableSeparator(lines[index + 1])) {
      const header = splitTableRow(line);
      const rows: string[][] = [];
      index += 2;
      while (index < lines.length && lines[index].includes("|") && !isBlank(lines[index])) {
        rows.push(splitTableRow(lines[index]));
        index += 1;
      }
      blocks.push({ type: "table", header, rows });
      continue;
    }

    const paragraph: string[] = [];
    while (index < lines.length) {
      const candidate = lines[index];
      if (isBlank(candidate) || headingMatch(candidate) || fenceMatch(candidate) || listMatch(candidate)
        || /^\s*>/.test(candidate) || (candidate.includes("|") && index + 1 < lines.length && tableSeparator(lines[index + 1]))) {
        break;
      }
      paragraph.push(candidate.trim());
      index += 1;
    }
    if (paragraph.length) {
      const text = paragraph.join("\n");
      blocks.push({ type: "paragraph", text, children: parseInline(text) });
    } else {
      index += 1;
    }
  }

  return blocks;
}

/** Plain text used for contract coverage checks. */
export function markdownPlainText(blocks: MarkdownBlock[]): string {
  const parts: string[] = [];
  for (const block of blocks) {
    if (block.type === "heading" || block.type === "paragraph" || block.type === "blockquote") parts.push(block.text);
    else if (block.type === "list") parts.push(...block.items.map((item) => item.text));
    else if (block.type === "table") parts.push(...block.header, ...block.rows.flat());
    else if (block.type === "code") parts.push(block.code);
  }
  return parts.join("\n");
}
