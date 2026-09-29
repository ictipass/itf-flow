import { parseDocument } from "htmlparser2";

export const RICH_TEXT_PREFIX = "RICH_TEXT_V1:";

type HtmlNode = {
  type: string;
  name?: string;
  data?: string;
  children?: HtmlNode[];
};

export type RichTextRun = { text: string; bold?: boolean; italic?: boolean; underline?: boolean };
export type RichTextBlock = { kind: "paragraph" | "heading" | "list-item" | "blockquote"; runs: RichTextRun[]; prefix?: string };

const allowedTags = new Set(["p", "div", "br", "strong", "b", "em", "i", "u", "h2", "h3", "ul", "ol", "li", "blockquote"]);
const discardedTags = new Set(["script", "style", "iframe", "object", "embed", "svg", "math"]);

function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

function nodes(value: string) {
  return (parseDocument(value).children ?? []) as HtmlNode[];
}

function sanitizeNode(node: HtmlNode): string {
  if (node.type === "text") return escapeHtml(node.data ?? "");
  if (node.type !== "tag") return "";
  const name = (node.name ?? "").toLowerCase();
  if (discardedTags.has(name)) return "";
  const children = (node.children ?? []).map(sanitizeNode).join("");
  if (!allowedTags.has(name)) return children;
  if (name === "br") return "<br>";
  const normalized = name === "div" ? "p" : name === "b" ? "strong" : name === "i" ? "em" : name;
  return `<${normalized}>${children}</${normalized}>`;
}

function sanitizeHtml(value: string) {
  return nodes(value).map(sanitizeNode).join("").trim();
}

function ensureBlockHtml(value: string) {
  if (!value || /<(p|h2|h3|ul|ol|blockquote)>/i.test(value)) return value;
  return `<p>${value.replace(/\r?\n/g, "<br>")}</p>`;
}

function plainTextFromNodes(items: HtmlNode[]): string {
  let result = "";
  for (const node of items) {
    if (node.type === "text") result += node.data ?? "";
    else if (node.type === "tag") {
      const name = (node.name ?? "").toLowerCase();
      if (discardedTags.has(name)) continue;
      if (name === "br") result += "\n";
      else {
        result += plainTextFromNodes(node.children ?? []);
        if (["p", "div", "h2", "h3", "li", "blockquote"].includes(name)) result += "\n";
      }
    }
  }
  return result.replace(/\u00a0/g, " ").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

export function richTextHtml(value: string | null | undefined) {
  if (!value) return "";
  if (value.startsWith(RICH_TEXT_PREFIX)) return ensureBlockHtml(sanitizeHtml(value.slice(RICH_TEXT_PREFIX.length)));
  return value.split(/\r?\n/).map((line) => `<p>${escapeHtml(line) || "<br>"}</p>`).join("");
}

export function richTextPlainText(value: string | null | undefined) {
  return plainTextFromNodes(nodes(richTextHtml(value)));
}

export function normalizeRichTextForStorage(value: FormDataEntryValue | null) {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return undefined;
  const sanitized = ensureBlockHtml(sanitizeHtml(raw.startsWith(RICH_TEXT_PREFIX) ? raw.slice(RICH_TEXT_PREFIX.length) : raw));
  const plain = plainTextFromNodes(nodes(sanitized));
  if (!plain) return undefined;
  if (plain.length > 20_000 || sanitized.length > 40_000) throw new Error("Memo content exceeds the permitted length.");
  return `${RICH_TEXT_PREFIX}${sanitized}`;
}

function inlineRuns(items: HtmlNode[], style: Omit<RichTextRun, "text"> = {}): RichTextRun[] {
  const runs: RichTextRun[] = [];
  for (const node of items) {
    if (node.type === "text") {
      if (node.data) runs.push({ text: node.data.replace(/\u00a0/g, " "), ...style });
      continue;
    }
    if (node.type !== "tag") continue;
    const name = (node.name ?? "").toLowerCase();
    if (name === "br") runs.push({ text: "\n", ...style });
    else if (!discardedTags.has(name)) runs.push(...inlineRuns(node.children ?? [], {
      ...style,
      bold: style.bold || name === "strong" || name === "b",
      italic: style.italic || name === "em" || name === "i",
      underline: style.underline || name === "u",
    }));
  }
  return runs;
}

export function richTextBlocks(value: string | null | undefined): RichTextBlock[] {
  const blocks: RichTextBlock[] = [];
  const visit = (items: HtmlNode[]) => {
    for (const node of items) {
      if (node.type === "text") {
        if (node.data?.trim()) blocks.push({ kind: "paragraph", runs: [{ text: node.data }] });
        continue;
      }
      if (node.type !== "tag") continue;
      const name = (node.name ?? "").toLowerCase();
      if (name === "ul" || name === "ol") {
        let index = 0;
        for (const child of node.children ?? []) {
          if (child.type !== "tag" || child.name?.toLowerCase() !== "li") continue;
          index++;
          blocks.push({ kind: "list-item", prefix: name === "ol" ? `${index}. ` : "- ", runs: inlineRuns(child.children ?? []) });
        }
      } else if (["p", "div", "h2", "h3", "blockquote"].includes(name)) {
        blocks.push({ kind: name === "h2" || name === "h3" ? "heading" : name === "blockquote" ? "blockquote" : "paragraph", runs: inlineRuns(node.children ?? []) });
      } else if (!discardedTags.has(name)) visit(node.children ?? []);
    }
  };
  visit(nodes(richTextHtml(value)));
  return blocks.length ? blocks : [{ kind: "paragraph", runs: [{ text: richTextPlainText(value) }] }];
}
