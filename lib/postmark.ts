const POSTMARK_API = 'https://api.postmarkapp.com';
const TOKEN        = process.env.POSTMARK_SERVER_TOKEN ?? '';
const FROM         = process.env.POSTMARK_FROM_EMAIL   ?? 'hello@debate.report';
const BASE_URL     = process.env.NEXT_PUBLIC_BASE_URL  ?? 'https://staging.debate.report';

export const PRODUCT_NAME = 'debate.report';
export const PRODUCT_URL  = BASE_URL;

export async function sendBlogNewsletter({
  to,
  subscriberName,
  postTitle,
  postExcerpt,
  postImageUrl,
  postSlug,
  unsubscribeToken,
}: {
  to:               string;
  subscriberName:   string;
  postTitle:        string;
  postExcerpt:      string;
  postImageUrl:     string;
  postSlug:         string;
  unsubscribeToken: string;
}) {
  const postUrl        = `${BASE_URL}/blog/${postSlug}`;
  const unsubscribeUrl = `${BASE_URL}/blog/unsubscribe?token=${unsubscribeToken}`;

  const res = await fetch(`${POSTMARK_API}/email/withTemplate`, {
    method:  'POST',
    headers: {
      'Accept':                  'application/json',
      'Content-Type':            'application/json',
      'X-Postmark-Server-Token': TOKEN,
    },
    body: JSON.stringify({
      From:          FROM,
      To:            to,
      TemplateAlias: 'vc-blog-newsletter-2',
      TemplateModel: {
        product_url:      PRODUCT_URL,
        product_name:     PRODUCT_NAME,
        subscriber_name:  subscriberName || 'Reader',
        post_title:       postTitle,
        post_excerpt:     postExcerpt,
        post_image_url:   postImageUrl || `${BASE_URL}/og-default.png`,
        post_url:         postUrl,
        unsubscribe_url:  unsubscribeUrl,
      },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Postmark error ${res.status}: ${body}`);
  }

  return res.json();
}
