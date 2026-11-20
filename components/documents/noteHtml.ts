'use client';

import DOMPurify from 'dompurify';

// Notes are HTML written in members' browsers, so they're cleaned before
// they're shown: only simple formatting survives, and links open safely.
const ALLOWED_TAGS = ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'h1', 'h2', 'h3', 'h4', 'ul', 'ol', 'li', 'blockquote', 'code', 'pre', 'a', 'hr'];
let hooked = false;

export function cleanNoteHtml(html: string): string {
  if (typeof window === 'undefined' || !html) return '';
  if (!hooked) {
    DOMPurify.addHook('afterSanitizeAttributes', node => {
      if (node.tagName !== 'A') return;
      const href = node.getAttribute('href') ?? '';
      if (!/^(https?:|mailto:)/i.test(href)) { node.removeAttribute('href'); return; }
      node.setAttribute('target', '_blank');
      node.setAttribute('rel', 'noopener noreferrer nofollow');
    });
    hooked = true;
  }
  return DOMPurify.sanitize(html, { ALLOWED_TAGS, ALLOWED_ATTR: ['href', 'target', 'rel'] });
}

/** True when a note's HTML has no words in it (an empty editor gives "<p></p>"). */
export const noteIsEmpty = (html: string) => !html.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, '').trim();
