import type { MetadataRoute } from "next";

// Who may crawl what (served as /robots.txt; Cloudflare adds its own block above).
//  - Search engines and AI search/assistants: everything public, but never
//    accounts, admin areas, the API or private share links.
//  - AI *training* crawlers: our own pages (marketing, guides, legal, newsletter)
//    only, never members’ content (debates, Societies, polls, profiles, uploads).
//    The privacy policy (section 1, "AI companies") promises this.

const NEVER = ["/api/", "/dashboard", "/admin", "/sysadmin", "/my-data", "/my-stuff", "/my-content",
  "/your-content", "/key", "/sso", "/stripe", "/s/"];

const OUR_PAGES = ["/$", "/features", "/pricing", "/about", "/how-it-works", "/guides", "/blog", "/newsletter",
  "/young-people", "/terms", "/privacy", "/contact", "/service", "/status", "/security", "/support",
  "/sitemap.xml", "/_next/static/", "/icon.svg"];

const AI_TRAINING = ["GPTBot", "ClaudeBot", "anthropic-ai", "Claude-Web", "CCBot", "Google-Extended",
  "Applebot-Extended", "GoogleOther", "Google-CloudVertexBot", "Amazonbot", "Bytespider", "meta-externalagent",
  "Meta-ExternalAgent", "FacebookBot", "cohere-ai", "cohere-training-data-crawler", "MistralAI-Training",
  "Diffbot", "omgili", "Timpibot", "ImagesiftBot", "AI2Bot", "PanguBot", "KimiBot"];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: NEVER },
      { userAgent: AI_TRAINING, allow: OUR_PAGES, disallow: "/" },
    ],
    host: "https://new.vote",
    sitemap: "https://new.vote/sitemap.xml",
  };
}
