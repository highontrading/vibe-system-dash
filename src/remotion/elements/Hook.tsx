import React from 'react';
import { AbsoluteFill, interpolate, spring } from 'remotion';
import type { EditPlan, Look } from '../../shared/schema';
import { fontFamily } from '../fonts';
import { rand, readableOn, springFor, textShadow, useInOut, useUnit } from './util';

const clean = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');

export const Hook: React.FC<{ hook: EditPlan['hook']; look: Look; durationFrames: number }> = ({
  hook,
  look,
  durationFrames,
}) => {
  const { frame, fps, enter, exit } = useInOut(durationFrames, look);
  const u = useUnit();
  const text = look.hook.uppercase ? hook.text.toUpperCase() : hook.text;
  const words = text.split(/\s+/).filter(Boolean);
  const hl = new Set(hook.highlight.map(clean));
  const isHl = (w: string) => hl.has(clean(w));
  const top = look.hook.position === 'top' ? '13%' : '42%';
  const long = text.length > 28;

  const wrap = (children: React.ReactNode, style: React.CSSProperties = {}) => (
    <AbsoluteFill style={{ pointerEvents: 'none', opacity: exit }}>
      <div
        style={{
          position: 'absolute',
          top,
          left: '6%',
          right: '6%',
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          alignItems: 'center',
          transform: 'translateY(-50%)',
          ...style,
        }}
      >
        {children}
      </div>
    </AbsoluteFill>
  );

  switch (look.hook.style) {
    case 'ransom': {
      const size = (long ? 64 : 92) * u;
      let i = 0;
      return wrap(
        words.map((w, wi) => (
          <div key={wi} style={{ display: 'flex', margin: `${size * 0.08}px ${size * 0.16}px` }}>
            {[...w].map((ch) => {
              const k = i++;
              const p = spring({ frame: frame - k * 1.5, fps, config: springFor(look) });
              const filled = isHl(w) ? true : rand(text, k) > 0.45;
              const bg = filled ? look.colors.primary : '#FFFFFF';
              return (
                <span
                  key={k}
                  style={{
                    fontFamily: fontFamily(look.fonts.heading),
                    fontSize: size,
                    fontWeight: 700,
                    lineHeight: 1,
                    color: readableOn(bg),
                    background: bg,
                    padding: `${size * 0.1}px ${size * 0.1}px`,
                    margin: `0 ${size * 0.02}px`,
                    border: `${3 * u}px solid #111`,
                    boxShadow: `${4 * u}px ${5 * u}px 0 rgba(0,0,0,0.35)`,
                    transform: `rotate(${(rand(text, k + 99) - 0.5) * 12}deg) scale(${p})`,
                    display: 'inline-block',
                  }}
                >
                  {ch}
                </span>
              );
            })}
          </div>
        )),
      );
    }
    case 'boxed': {
      const size = (long ? 58 : 76) * u;
      return wrap(
        <div
          style={{
            background: look.colors.primary,
            color: look.colors.ink,
            fontFamily: fontFamily(look.fonts.heading),
            fontWeight: 800,
            fontSize: size,
            lineHeight: 1.12,
            padding: `${size * 0.32}px ${size * 0.5}px`,
            borderRadius: size * 0.32,
            textAlign: 'center',
            transform: `scale(${0.8 + 0.2 * enter}) rotate(${-2 + 2 * enter}deg)`,
            opacity: enter,
            boxShadow: `0 ${10 * u}px ${30 * u}px rgba(0,0,0,0.35)`,
          }}
        >
          {words.map((w, i) => (
            <span key={i} style={{ color: isHl(w) ? look.colors.accent : undefined }}>
              {w}{' '}
            </span>
          ))}
        </div>,
      );
    }
    case 'stacked': {
      const size = (long ? 70 : 96) * u;
      return wrap(
        words.map((w, i) => {
          const p = spring({ frame: frame - i * 3, fps, config: springFor(look) });
          const bg = i % 2 === 0 ? look.colors.primary : '#FFFFFF';
          return (
            <div key={i} style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
              <span
                style={{
                  fontFamily: fontFamily(look.fonts.heading),
                  fontSize: size,
                  lineHeight: 1,
                  color: readableOn(bg),
                  background: bg,
                  padding: `${size * 0.1}px ${size * 0.24}px`,
                  marginBottom: size * 0.06,
                  transform: `translateX(${(1 - p) * (i % 2 ? 300 : -300) * u}px)`,
                  opacity: p,
                }}
              >
                {w}
              </span>
            </div>
          );
        }),
      );
    }
    case 'big': {
      const size = (long ? 110 : 150) * u;
      const punch = interpolate(enter, [0, 1], [1.6, 1]);
      return wrap(
        <div
          style={{
            fontFamily: fontFamily(look.fonts.heading),
            fontSize: size,
            lineHeight: 0.95,
            color: '#FFFFFF',
            textAlign: 'center',
            transform: `scale(${punch})`,
            opacity: Math.min(1, enter * 1.5),
            textShadow: textShadow(u * 1.6),
            WebkitTextStroke: `${4 * u}px #000`,
            paintOrder: 'stroke fill',
          }}
        >
          {words.map((w, i) => (
            <span key={i} style={{ color: isHl(w) ? look.colors.accent : undefined }}>
              {w}{' '}
            </span>
          ))}
        </div>,
      );
    }
    case 'minimal':
    default: {
      const size = (long ? 66 : 84) * u;
      return wrap(
        <div
          style={{
            fontFamily: fontFamily(look.fonts.heading),
            fontSize: size,
            lineHeight: 1.05,
            color: '#FFFFFF',
            textAlign: 'center',
            textShadow: textShadow(u),
            transform: `translateY(${(1 - enter) * 40 * u}px)`,
            opacity: enter,
          }}
        >
          {words.map((w, i) => (
            <span
              key={i}
              style={{ color: isHl(w) ? look.colors.accent : undefined, fontStyle: isHl(w) ? 'italic' : undefined }}
            >
              {w}{' '}
            </span>
          ))}
        </div>,
      );
    }
  }
};
