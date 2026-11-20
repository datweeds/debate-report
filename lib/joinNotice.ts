import pool from '@/lib/db';
import { sendMemberNotice, PRODUCT_URL } from '@/lib/postmark';

// Email someone the decision on their request to join a Society or a debate,
// if they gave us an email address. The debate's title isn't sent (it may be
// private), only its Society. Fire and forget.
export async function notifyJoinDecision(userId: string, customerId: number | null, approved: boolean, kind: 'society' | 'debate') {
  try {
    const { rows: [r] } = await pool.query(
      `SELECT u.email, u.user_handle, c.name, c.subdomain FROM users u LEFT JOIN customers c ON c.id = $2 WHERE u.id::text = $1`,
      [userId, customerId]);
    if (!r?.email || !/@/.test(r.email)) return;
    const society = r.name ?? 'new.vote';
    const where = kind === 'society' ? society : `a debate in ${society}`;
    const link = customerId ? `${PRODUCT_URL}/society/${r.subdomain || customerId}` : PRODUCT_URL;
    await sendMemberNotice({
      to: r.email,
      subject: approved ? `You've been accepted into ${where}` : `Your request to join ${where}`,
      text: approved
        ? `Hello ${r.user_handle ?? ''},\n\nGood news: your request to join ${where} has been approved. You can take part now:\n${link}`
        : `Hello ${r.user_handle ?? ''},\n\nYour request to join ${where} was not approved this time. If you think this is a mistake, you can contact the Society's moderators from its About page:\n${link}${kind === 'society' ? '/about' : ''}`,
    });
  } catch (err) {
    console.error('[join notice]', err);
  }
}
