const POSTMARK_API = 'https://api.postmarkapp.com';
const TOKEN        = process.env.POSTMARK_SERVER_TOKEN ?? '';
const FROM         = process.env.POSTMARK_FROM_EMAIL   ?? 'hello@new.vote';
const BASE_URL     = process.env.NEXT_PUBLIC_BASE_URL  ?? 'https://new.vote';

export const PRODUCT_NAME = 'new.vote';
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

// Contact form → the team's inbox. Reply-To is the sender, so replying in the
// mail client answers them directly.
const CONTACT_TO   = process.env.CONTACT_TO_EMAIL   ?? 'contact@new.vote';
const CONTACT_FROM = process.env.CONTACT_FROM_EMAIL ?? 'contact@new.vote';

export async function sendContactNotification({ name, email, subject, message, to = CONTACT_TO, context = `the contact form at ${BASE_URL}/contact` }: {
  name: string; email: string; subject: string; message: string;
  to?: string;        // default: the site's contact address
  context?: string;   // where the message was sent from, for the footer
}) {
  const send = (from: string) => fetch(`${POSTMARK_API}/email`, {
    method:  'POST',
    headers: {
      'Accept':                  'application/json',
      'Content-Type':            'application/json',
      'X-Postmark-Server-Token': TOKEN,
    },
    body: JSON.stringify({
      From:     `${PRODUCT_NAME} contact form <${from}>`,
      To:       to,
      ReplyTo:  `${name.replace(/[<>"\r\n]/g, '')} <${email}>`,
      Subject:  `[${PRODUCT_NAME} contact] ${subject}`.slice(0, 250),
      TextBody: `From: ${name} <${email}>\nSubject: ${subject}\n\n${message}\n\n— Sent from ${context}`,
      MessageStream: 'outbound',
    }),
  });

  let res = await send(CONTACT_FROM);
  // Until CONTACT_FROM is a confirmed Postmark sender, fall back to the
  // account's existing sender so messages still arrive.
  if (res.status === 422 && CONTACT_FROM !== FROM) {
    const body = await res.text();
    if (/sender signature/i.test(body)) res = await send(FROM);
    else throw new Error(`Postmark error 422: ${body}`);
  }
  if (!res.ok) throw new Error(`Postmark error ${res.status}: ${await res.text()}`);
  return res.json();
}

// A plain notice to one member (e.g. the decision on their join request).
// Sent from the account's sender; never throws, as the decision already stands.
export async function sendMemberNotice({ to, subject, text }: { to: string; subject: string; text: string }) {
  if (!TOKEN) return;
  try {
    const res = await fetch(`${POSTMARK_API}/email`, {
      method:  'POST',
      headers: { 'Accept': 'application/json', 'Content-Type': 'application/json', 'X-Postmark-Server-Token': TOKEN },
      body: JSON.stringify({
        From: `${PRODUCT_NAME} <${FROM}>`, To: to, Subject: subject.slice(0, 250),
        TextBody: `${text}\n\n— ${PRODUCT_NAME}\n${BASE_URL}/my-content`, MessageStream: 'outbound',
      }),
    });
    if (!res.ok) console.error('[member notice]', res.status, await res.text());
  } catch (err) {
    console.error('[member notice]', err);
  }
}
