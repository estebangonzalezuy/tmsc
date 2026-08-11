// A small Notion REST client — enough of the API for the content cycle and
// nothing more. No SDK: the surface we touch is four endpoints.
//
// Uses API version 2025-09-03, where databases are containers and rows live
// in *data sources*. The three ids in config.mjs are data source ids, the
// same `collection://<uuid>` values the Notion connector shows in chat.

const API = "https://api.notion.com/v1";
const VERSION = "2025-09-03";

/** Notion allows ~3 requests/second; stay under it without thinking about it. */
const GAP_MS = 360;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export class Notion {
  constructor(token) {
    if (!token) throw new Error("NOTION_TOKEN is missing");
    this.token = token;
    this.next = 0;
  }

  async req(method, path, body) {
    const wait = this.next - Date.now();
    if (wait > 0) await sleep(wait);
    this.next = Date.now() + GAP_MS;

    for (let attempt = 0; ; attempt++) {
      const res = await fetch(API + path, {
        method,
        headers: {
          Authorization: `Bearer ${this.token}`,
          "Notion-Version": VERSION,
          "Content-Type": "application/json",
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      if (res.ok) return res.json();

      const text = await res.text();
      const retryable = res.status === 429 || res.status >= 500;
      if (!retryable || attempt >= 4) {
        throw new Error(`Notion ${method} ${path} → ${res.status}: ${text}`);
      }
      const after = Number(res.headers.get("retry-after")) || 2 ** attempt;
      await sleep(after * 1000);
    }
  }

  /** Every row matching a filter, following pagination. */
  async query(dataSource, { filter, sorts } = {}) {
    const rows = [];
    let cursor;
    do {
      const page = await this.req("POST", `/data_sources/${dataSource}/query`, {
        filter,
        sorts,
        page_size: 100,
        start_cursor: cursor,
      });
      rows.push(...page.results);
      cursor = page.has_more ? page.next_cursor : undefined;
    } while (cursor);
    return rows;
  }

  byStatus(dataSource, status) {
    return this.query(dataSource, {
      filter: { property: "Status", select: { equals: status } },
    });
  }

  /* A page's body as plain text. Dictating into the page rather than into a
     property is the natural thing to do on a phone, so read both. */
  async blockText(pageId) {
    const out = [];
    let cursor;
    do {
      const page = await this.req(
        "GET",
        `/blocks/${pageId}/children?page_size=100` +
          (cursor ? `&start_cursor=${cursor}` : ""),
      );
      for (const b of page.results) {
        const rich = b[b.type]?.rich_text;
        if (Array.isArray(rich) && rich.length) {
          out.push(rich.map((t) => t.plain_text).join(""));
        }
      }
      cursor = page.has_more ? page.next_cursor : undefined;
    } while (cursor);
    return out.join("\n");
  }

  /* The sub-pages of an ordinary page, which is what a Notion journal kept
     by hand actually is: one page per day, nested under one parent. Not a
     database, so there is nothing to query — the children have to be
     listed. */
  async childPages(pageId) {
    const out = [];
    let cursor;
    do {
      const page = await this.req(
        "GET",
        `/blocks/${pageId}/children?page_size=100` +
          (cursor ? `&start_cursor=${cursor}` : ""),
      );
      for (const b of page.results) {
        if (b.type !== "child_page") continue;
        out.push({
          id: b.id,
          title: b.child_page?.title ?? "",
          created: b.created_time ?? "",
          url: `https://www.notion.so/${String(b.id).replace(/-/g, "")}`,
        });
      }
      cursor = page.has_more ? page.next_cursor : undefined;
    } while (cursor);
    return out;
  }

  createPage(dataSource, properties, children) {
    return this.req("POST", "/pages", {
      parent: { type: "data_source_id", data_source_id: dataSource },
      properties,
      ...(children?.length ? { children } : {}),
    });
  }

  updatePage(pageId, properties) {
    return this.req("PATCH", `/pages/${pageId}`, { properties });
  }
}

/* ------------------------------------------------------------- writing --- */

/* A single rich text object caps at 2000 characters, and LinkedIn drafts run
   longer — split on that boundary rather than silently truncating. */
const chunks = (s, n = 1900) => {
  const out = [];
  for (let i = 0; i < s.length; i += n) out.push(s.slice(i, i + n));
  return out.length ? out : [""];
};

/* A long capture goes in the page body rather than the Entry property: a
   rich-text property is capped, and a dictated journal entry runs past it.
   Every job that reads a journal row reads the body too. */
export const paragraphs = (s) =>
  chunks(String(s ?? "").trim())
    .filter((c) => c.length)
    .map((content) => ({
      object: "block",
      type: "paragraph",
      paragraph: { rich_text: [{ type: "text", text: { content } }] },
    }));

export const put = {
  title: (s) => ({ title: [{ text: { content: String(s).slice(0, 1900) } }] }),
  text: (s) => ({
    rich_text: chunks(String(s ?? "")).map((content) => ({ text: { content } })),
  }),
  select: (name) => ({ select: name ? { name } : null }),
  url: (u) => ({ url: u || null }),
  date: (start) => ({ date: start ? { start } : null }),
  relation: (ids) => ({ relation: (ids ?? []).filter(Boolean).map((id) => ({ id })) }),
};

/* ------------------------------------------------------------- reading --- */

const flat = (arr) => (arr ?? []).map((t) => t.plain_text).join("");

export const get = {
  title: (row, key = "Name") => flat(row.properties?.[key]?.title),
  text: (row, key) => flat(row.properties?.[key]?.rich_text),
  select: (row, key) => row.properties?.[key]?.select?.name ?? "",
  url: (row, key) => row.properties?.[key]?.url ?? "",
  date: (row, key) => row.properties?.[key]?.date?.start ?? "",
  relation: (row, key) =>
    (row.properties?.[key]?.relation ?? []).map((r) => r.id),
};
