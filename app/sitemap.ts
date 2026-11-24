import type { MetadataRoute } from "next";
import { getAllPosts } from "@/lib/blog";
import pool from "@/lib/db";

// /sitemap.xml: new.vote’s own public pages, blog posts and sent newsletter
// issues, for search engines. Members’ content (Societies, debates) isn’t listed.
export const dynamic = "force-dynamic";
export const revalidate = 3600;

const SITE = "https://new.vote";

const PAGES: [string, number][] = [
  ["/", 1], ["/features", 0.9], ["/pricing", 0.9], ["/about", 0.7], ["/how-it-works", 0.7],
  ["/guides", 0.7], ["/guides/member", 0.6], ["/guides/admin", 0.6], ["/guides/guest", 0.5],
  ["/guides/society-admin-procedure", 0.5], ["/young-people", 0.6], ["/guides/age-check", 0.5],
  ["/blog", 0.6], ["/contact", 0.5], ["/support", 0.5], ["/service", 0.4],
  ["/status", 0.3], ["/security", 0.3], ["/terms", 0.3], ["/privacy", 0.3],
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const pages: MetadataRoute.Sitemap = PAGES.map(([p, priority]) => ({ url: SITE + p, priority }));

  let posts: MetadataRoute.Sitemap = [];
  try {
    posts = getAllPosts().map(p => ({
      url: `${SITE}/blog/${p.slug}`, priority: 0.5,
      ...(p.date && !isNaN(Date.parse(p.date)) ? { lastModified: new Date(p.date) } : {}),
    }));
  } catch { /* no posts */ }

  let issues: MetadataRoute.Sitemap = [];
  try {
    const { rows } = await pool.query(
      `SELECT id, sent_at FROM newsletter_issues WHERE status = \x27sent\x27 ORDER BY sent_at DESC LIMIT 500`);
    issues = rows.map(r => ({ url: `${SITE}/newsletter/${r.id}`, lastModified: r.sent_at, priority: 0.4 }));
  } catch { /* database unavailable: list the rest */ }

  return [...pages, ...posts, ...issues];
}
