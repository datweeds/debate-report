'use client';

import RefHtml from '@/components/refs/RefHtml';
import RichText from '@/components/discussions/RichText';

// A project task's description is rich text (HTML, cleaned when shown).
// Descriptions written before that are plain text: shown as before, and
// turned into HTML when the task is next edited.
export const isHtml = (s: string) => /^\s*<(p|h[1-6]|ul|ol|blockquote|pre|hr)[\s>]/i.test(s);

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const URL_RE = /(https?:\/\/[^\s<]+[^\s<.,;:!?)\]'"])/g;

/** HTML for the editor, from an old plain-text description (HTML is left alone). */
export function toHtml(s: string | null | undefined): string {
  if (!s) return '';
  if (isHtml(s)) return s;
  return s.split(/\n{2,}/).map(par =>
    `<p>${esc(par).replace(URL_RE, u => `<a href="${u}">${u}</a>`).replace(/\n/g, '<br>')}</p>`).join('');
}

export default function Description({ text }: { text: string }) {
  return isHtml(text) ? <RefHtml html={text} /> : <RichText text={text} />;
}
