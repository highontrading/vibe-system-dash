import React from 'react';
import { AbsoluteFill, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import type { Look } from '../../shared/schema';
import type { CaptionChunk } from '../../shared/timeline';
import { fontFamily } from '../fonts';
import { springFor, textShadow, useUnit } from './util';

const TOP: Record<Look['captions']['position'], string> = {
  top: '20%',
  middle: '62%',
  bottom: '76%',
};

export const Captions: React.FC<{ chunks: CaptionChunk[]; look: Look }> = ({ chunks, look }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const u = useUnit();
  const t = frame / fps;
  const chunk = chunks.find((c) => t >= c.start && t < c.end);
  if (!chunk) return null;

  const c = look.captions;
  const base = (c.style === 'single' ? 104 : 72) * c.size * u;
  const words = c.style === 'single'
    ? chunk.words.filter((w) => t >= w.oStart).slice(-1)
    : chunk.words;
  const chunkFrame = frame - Math.round(chunk.start * fps);
  const chunkIn = spring({ frame: chunkFrame, fps, config: springFor(look) });

  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <div
        style={{
          position: 'absolute',
          top: TOP[c.position],
          left: '7%',
          right: '7%',
          transform: 'translateY(-50%)',
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          alignItems: 'center',
          gap: `${base * 0.12}px ${base * 0.24}px`,
          fontFamily: fontFamily(look.fonts.caption),
          fontWeight: 800,
          fontSize: base,
          lineHeight: 1.08,
          textAlign: 'center',
          textTransform: c.uppercase ? 'uppercase' : 'none',
          ...(c.style === 'boxed'
            ? {
                background: look.colors.primary,
                padding: `${base * 0.18}px ${base * 0.34}px`,
                borderRadius: base * 0.2,
                left: 'auto',
                right: 'auto',
                maxWidth: '86%',
                marginLeft: '50%',
                transform: `translate(-50%, -50%) scale(${0.85 + 0.15 * chunkIn})`,
              }
            : null),
        }}
      >
        {words.map((w) => {
          const active = t >= w.oStart && t < w.oEnd + 0.05;
          const spoken = t >= w.oStart;
          const wf = frame - Math.round(w.oStart * fps);
          const pop = spring({ frame: wf, fps, config: springFor(look) });
          const highlight = w.emphasis || active;
          let color = c.style === 'boxed' ? look.colors.ink : look.colors.text;
          let background: string | undefined;
          let transform: string | undefined;
          let opacity = 1;

          switch (c.style) {
            case 'pop':
              opacity = spoken ? 1 : 0;
              transform = `scale(${spoken ? 0.6 + 0.4 * pop : 0.6})`;
              if (highlight) color = look.colors.accent;
              break;
            case 'karaoke':
              opacity = spoken ? 1 : 0.55;
              if (active) {
                background = look.colors.accent;
                color = '#111111';
              } else if (w.emphasis) color = look.colors.accent;
              break;
            case 'boxed':
              if (highlight) color = look.colors.accent === look.colors.primary ? '#FFFFFF' : look.colors.accent;
              opacity = spoken ? 1 : 0.45;
              break;
            case 'clean':
              opacity = chunkIn;
              if (w.emphasis) color = look.colors.accent;
              break;
            case 'single':
              transform = `scale(${0.7 + 0.3 * pop})`;
              if (w.emphasis) color = look.colors.accent;
              break;
          }

          return (
            <span
              key={w.index}
              style={{
                display: 'inline-block',
                color,
                background,
                opacity,
                transform,
                padding: background ? `0 ${base * 0.12}px` : undefined,
                borderRadius: background ? base * 0.14 : undefined,
                textShadow: c.style === 'boxed' || background ? 'none' : textShadow(u),
                WebkitTextStroke: c.style === 'pop' || c.style === 'single' ? `${2.5 * u}px rgba(0,0,0,0.85)` : undefined,
                paintOrder: 'stroke fill',
              }}
            >
              {w.text.trim()}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
