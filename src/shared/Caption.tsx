import React from 'react';
import {interpolate, useCurrentFrame} from 'remotion';
import {FONT} from './Mascot';

// Word-by-word Arabic caption synced to one voice line (shared by the newer family episodes).
export type Word = {w: string; start: number; end: number};
export type V = {src: string; at: number; sec: number; words: Word[]};
const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

export const groupLatin = (ws: Word[]) => ws.reduce<Word[]>((a, w) => {
  const prev = a[a.length - 1];
  if (prev && /^[A-Za-z]/.test(prev.w) && /^[A-Za-z]/.test(w.w)) {a[a.length - 1] = {w: `${prev.w} ${w.w}`, start: prev.start, end: w.end}; return a;}
  a.push(w); return a;
}, []);

export const Caption: React.FC<{line: V; top: number; accent: string; bg?: string}> = ({line, top, accent, bg = '#1b1a17'}) => {
  const frame = useCurrentFrame();
  const t = (frame - line.at) / 30;
  if (t < -0.1 || t > line.sec + 0.4) return null;
  return (
    <div dir="rtl" lang="ar" style={{position: 'absolute', top, left: 40, right: 40, textAlign: 'center', fontFamily: FONT, fontWeight: 900, fontSize: 68, lineHeight: 1.35,
      opacity: interpolate(t, [line.sec + 0.15, line.sec + 0.4], [1, 0], clamp)}}>
      <span style={{background: bg, boxDecorationBreak: 'clone', WebkitBoxDecorationBreak: 'clone', padding: '2px 18px', borderRadius: 16, lineHeight: 1.55}}>
        {groupLatin(line.words).map((w, i, ws) => {
          const said = t >= w.start;
          const on = said && t < (ws[i + 1]?.start ?? w.end + 0.3);
          return (
            <span key={i} dir={/[A-Za-z]/.test(w.w) ? 'ltr' : undefined} style={{display: 'inline-block', unicodeBidi: 'isolate', margin: '0 0.13em',
              color: on ? accent : said ? '#fff' : 'rgba(255,255,255,.35)', scale: on ? '1.06' : '1'}}>{w.w}</span>
          );
        })}
      </span>
    </div>
  );
};
