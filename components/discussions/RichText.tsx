// Message text with line breaks kept and web addresses turned into links.
// React escapes everything else, so no HTML from users is ever rendered.
// Addresses of other items in a Society show as reference chips (with a preview).
import RefChip from '@/components/refs/RefChip';
import { parseRef } from '@/lib/refs';

const URL_RE = /(https?:\/\/[^\s<]+[^\s<.,;:!?)\]'"]|www\.[^\s<]+[^\s<.,;:!?)\]'"])/g;

export default function RichText({ text }: { text: string }) {
  const parts = text.split(URL_RE);
  return (
    <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-200">
      {parts.map((part, i) => {
        if (i % 2 === 0) return part;
        const href = part.startsWith('www.') ? `https://${part}` : part;
        const ref = parseRef(href);
        if (ref) return <RefChip key={i} r={ref} />;
        return (
          <a key={i} href={href} target="_blank" rel="noopener noreferrer nofollow ugc"
            className="text-blue-400 underline underline-offset-2 hover:text-blue-300 break-all">
            {part}
          </a>
        );
      })}
    </p>
  );
}
