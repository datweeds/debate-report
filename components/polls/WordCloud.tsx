'use client';

import { useEffect, useRef } from 'react';

const PALETTE = ['#60a5fa', '#a78bfa', '#34d399', '#f472b6', '#fb923c', '#38bdf8', '#fbbf24', '#4ade80', '#c084fc'];

// Words sized by how often they were given (from poll.voter.care)
export default function WordCloud({ words, height = 240 }: { words: { word: string; count: number }[]; height?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function draw() {
      const canvas = canvasRef.current, box = boxRef.current;
      if (!canvas || !box) return;
      const dpr = window.devicePixelRatio || 1;
      const W = Math.max(box.clientWidth, 200), H = height;
      canvas.width = W * dpr; canvas.height = H * dpr;
      canvas.style.width = `${W}px`; canvas.style.height = `${H}px`;
      const ctx = canvas.getContext('2d')!;
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, W, H);
      if (!words.length) {
        ctx.fillStyle = 'rgba(148,163,184,0.5)'; ctx.font = '14px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText('No answers yet', W / 2, H / 2 + 5);
        return;
      }
      const maxCount = words[0].count, minFont = 13;
      const maxFont = Math.min(56, H * 0.38 * Math.max(0.4, 1 / Math.sqrt(words.length)));
      const placed: { x: number; y: number; w: number; h: number }[] = [];
      words.slice(0, 40).forEach(({ word, count }, wi) => {
        const t = count / maxCount;
        const weight = t > 0.5 ? '700' : t > 0.25 ? '600' : '500';
        const base = Math.round(minFont + t * (maxFont - minFont));
        const start = (wi * 2.39996) % (Math.PI * 2);
        for (let shrink = 0; shrink < 5; shrink++) {
          const size = Math.max(minFont, Math.round(base * (1 - shrink * 0.18)));
          ctx.font = `${weight} ${size}px -apple-system, BlinkMacSystemFont, sans-serif`;
          const bw = ctx.measureText(word).width + 10, bh = size + 8;
          for (let it = 0; it < 2400; it++) {
            const r = it * Math.min(W, H) / 400, th = start + it * 0.3;
            const x = W / 2 + r * (W / H) * Math.cos(th) - bw / 2, y = H / 2 + r * Math.sin(th) - bh / 2;
            if (x < 2 || y < 2 || x + bw > W - 2 || y + bh > H - 2) continue;
            if (placed.some(p => x < p.x + p.w + 3 && x + bw + 3 > p.x && y < p.y + p.h + 3 && y + bh + 3 > p.y)) continue;
            placed.push({ x, y, w: bw, h: bh });
            ctx.fillStyle = PALETTE[wi % PALETTE.length]; ctx.textAlign = 'left';
            ctx.fillText(word, x + 5, y + bh - 6);
            return;
          }
        }
      });
    }
    draw();
    const ro = new ResizeObserver(draw);
    if (boxRef.current) ro.observe(boxRef.current);
    return () => ro.disconnect();
  }, [words, height]);

  return <div ref={boxRef} className="w-full"><canvas ref={canvasRef} className="block" /></div>;
}
