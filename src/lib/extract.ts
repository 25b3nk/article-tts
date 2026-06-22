import { Readability } from "@mozilla/readability";

export interface Paragraph {
  id: number;
  text: string;
}

export interface ExtractedArticle {
  title: string | null;
  paragraphs: Paragraph[];
}

function splitIntoParagraphs(text: string): Paragraph[] {
  return text
    .split(/\n{2,}/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter((p) => p.length > 0)
    .map((text, id) => ({ id, text }));
}

export function extractFromPlainText(text: string): ExtractedArticle {
  return { title: null, paragraphs: splitIntoParagraphs(text) };
}

export function extractFromHtml(html: string, baseUrl?: string): ExtractedArticle {
  const doc = new DOMParser().parseFromString(html, "text/html");
  if (baseUrl) {
    const base = doc.createElement("base");
    base.href = baseUrl;
    doc.head.appendChild(base);
  }

  const reader = new Readability(doc);
  const article = reader.parse();

  if (!article || !article.content) {
    throw new Error("Could not extract article content from this page.");
  }

  const contentDoc = new DOMParser().parseFromString(article.content, "text/html");
  const blocks = Array.from(contentDoc.querySelectorAll("p, h2, h3, li"));
  const paragraphs = blocks
    .map((el) => el.textContent?.replace(/\s+/g, " ").trim() ?? "")
    .filter((t) => t.length > 0)
    .map((text, id) => ({ id, text }));

  if (paragraphs.length === 0) {
    // Fall back to splitting plain text content if structural extraction yields nothing
    return { title: article.title ?? null, paragraphs: splitIntoParagraphs(article.textContent ?? "") };
  }

  return { title: article.title ?? null, paragraphs };
}

export function withProxy(url: string, proxyUrl: string | null): string {
  if (!proxyUrl) return url;
  return proxyUrl.includes("{url}")
    ? proxyUrl.replace("{url}", encodeURIComponent(url))
    : proxyUrl + encodeURIComponent(url);
}

export async function fetchArticleHtml(
  url: string,
  proxyUrl: string | null,
): Promise<string> {
  const fetchUrl = withProxy(url, proxyUrl);
  const res = await fetch(fetchUrl);
  if (!res.ok) {
    throw new Error(`Failed to fetch page (${res.status} ${res.statusText})`);
  }
  return res.text();
}
