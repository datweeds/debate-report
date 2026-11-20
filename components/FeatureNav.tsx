'use client';

import { useEffect, useRef, useState } from 'react';

// The Features page's section menu: floats under the site header while you
// scroll, and highlights the section you're reading.
export default function FeatureNav({ sections }: { sections: { id: string; label: string; accent?: boolean }[] }) {
  const [active, setActive] = useState<string | null>(null);
  const bar = useRef<HTMLDivElement>(null);
  const clickedAt = useRef(0);   // a chip just clicked keeps its highlight while the page scrolls to it

  // The section being read: the last one whose top has passed just below this bar
  // (or the last section, once the page is scrolled to the bottom)
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      if (Date.now() - clickedAt.current < 1000) return;
      const line = (bar.current?.getBoundingClientRect().bottom ?? 140) + 24;
      const atEnd = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
      let current: string | null = null;
      for (const s of sections) {
        const el = document.getElementById(s.id);
        if (el && el.getBoundingClientRect().top <= line) current = s.id;
      }
      setActive(atEnd ? sections[sections.length - 1]?.id ?? current : current);
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(update); };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => { window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll); cancelAnimationFrame(frame); };
  }, [sections]);

  // Keep the highlighted chip in view on narrow screens
  useEffect(() => {
    const chip = active ? bar.current?.querySelector<HTMLElement>(`[data-id="${active}"]`) : null;
    if (chip && bar.current) bar.current.scrollTo({ left: chip.offsetLeft - 16, behavior: 'smooth' });
  }, [active]);

  return (
    <div className="sticky top-16 z-30 border-b border-blue-900/25 bg-dr-base/90 backdrop-blur-md">
      <nav aria-label="Feature sections" ref={bar} className="mx-auto flex max-w-5xl gap-2 overflow-x-auto overflow-y-hidden px-4 py-3 sm:flex-wrap sm:overflow-visible sm:px-6">
        {sections.map(s => {
          const on = active === s.id;
          return (
            <a key={s.id} href={`#${s.id}`} data-id={s.id} aria-current={on ? 'location' : undefined}
              onClick={() => { clickedAt.current = Date.now(); setActive(s.id); }}
              className={`flex-none rounded-full px-3.5 py-1.5 text-sm transition-colors duration-200 ${
                s.accent
                  ? 'bg-amber-400 font-semibold text-slate-950 hover:bg-amber-300'
                  : on
                    ? 'border border-blue-500 bg-blue-500/15 text-blue-200'
                    : 'border border-blue-900/40 text-slate-300 hover:border-blue-500/60 hover:bg-blue-500/[0.06] hover:text-white'
              }`}>
              {s.label}
            </a>
          );
        })}
      </nav>
    </div>
  );
}
