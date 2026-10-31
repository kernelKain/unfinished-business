import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { parseMarkdown, safeHref, sanitizeGeneratedMarkdown } from "../src/shared/markdown.ts";
import { Markdown } from "../src/web/components/Markdown.tsx";

function render(content: string): string {
  return renderToStaticMarkup(createElement(Markdown, { content }));
}

test("renders headings, paragraphs, lists, emphasis, links, tables, and code", () => {
  const html = render([
    "# Heading one",
    "",
    "A paragraph with **strong**, *emphasis*, `inline code`, and [a link](https://example.com/docs).",
    "",
    "- first",
    "- second",
    "",
    "1. one",
    "2. two",
    "",
    "| Name | Value |",
    "| --- | --- |",
    "| alpha | 1 |",
    "",
    "```ts",
    "const value = 1;",
    "```",
  ].join("\n"));

  assert.match(html, /<h1>Heading one<\/h1>/);
  assert.match(html, /<p>A paragraph with <strong>strong<\/strong>, <em>emphasis<\/em>/);
  assert.match(html, /<code>inline code<\/code>/);
  assert.match(html, /<a href="https:\/\/example.com\/docs" target="_blank" rel="noreferrer noopener">a link<\/a>/);
  assert.match(html, /<ul><li>first<\/li><li>second<\/li><\/ul>/);
  assert.match(html, /<ol><li>one<\/li><li>two<\/li><\/ol>/);
  assert.match(html, /<table>/);
  assert.match(html, /<th>Name<\/th>/);
  assert.match(html, /<td>alpha<\/td>/);
  assert.match(html, /<pre class="markdown-code"><code class="language-ts">const value = 1;<\/code><\/pre>/);
});

test("raw HTML and scripts are never executable and are rendered as text", () => {
  const html = render([
    "# Safe",
    "",
    "<script>alert('owned')</script>",
    "",
    "<img src=x onerror=\"alert('owned')\">",
    "",
    "<div onclick=\"alert('owned')\">not a real div</div>",
  ].join("\n"));

  assert.doesNotMatch(html, /<script/i);
  assert.doesNotMatch(html, /<img/i);
  assert.doesNotMatch(html, /<div onclick/i);
  assert.match(html, /\[removed script\]/);
  assert.match(html, /&lt;img src=x onerror=&quot;alert\(&#x27;owned&#x27;\)&quot;&gt;/);
});

test("unsafe links are downgraded to text and safe protocols survive", () => {
  const html = render([
    "[bad](javascript:alert(1))",
    "",
    "[also bad](data:text/html;base64,PHNjcmlwdD4=)",
    "",
    "[mail](mailto:team@example.com)",
  ].join("\n"));

  assert.doesNotMatch(html, /javascript:/i);
  assert.doesNotMatch(html, /data:text\/html/i);
  assert.doesNotMatch(html, /href="javascript/i);
  assert.match(html, /<p>bad<\/p>/);
  assert.match(html, /href="mailto:team@example.com"/);
  assert.equal(safeHref("javascript:alert(1)"), null);
  assert.equal(safeHref("//evil.example/path"), null);
  assert.equal(safeHref("https://example.com"), "https://example.com");
});

test("sanitization removes script/style blocks and control characters", () => {
  const cleaned = sanitizeGeneratedMarkdown("a\u0000b<script>alert(1)</script>c<style>body{}</style>d");
  assert.equal(cleaned.includes("\u0000"), false);
  assert.doesNotMatch(cleaned, /<script/i);
  assert.doesNotMatch(cleaned, /<style/i);
  assert.match(cleaned, /\[removed script\]/);
  assert.match(cleaned, /\[removed style\]/);
});

test("the parser keeps block boundaries deterministic", () => {
  const blocks = parseMarkdown("# One\n\nText\n\n- a\n- b\n\n| h |\n| --- |\n| v |");
  assert.deepEqual(blocks.map((block) => block.type), ["heading", "paragraph", "list", "table"]);
});
