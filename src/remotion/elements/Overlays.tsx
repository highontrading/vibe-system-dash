import React from 'react';
import { AbsoluteFill, interpolate, spring } from 'remotion';
import type { Look, Overlay } from '../../shared/schema';
import { fontFamily } from '../fonts';
import { rand, readableOn, springFor, textShadow, useInOut, useUnit } from './util';

type Props = { overlay: Overlay; look: Look; durationFrames: number };

const POS: Record<Overlay['position'], React.CSSProperties> = {
  top: { top: '22%', left: '50%' },
  center: { top: '45%', left: '50%' },
  bottom: { top: '68%', left: '50%' },
  left: { top: '45%', left: '28%' },
  right: { top: '45%', left: '72%' },
};

const Anchor: React.FC<{ position: Overlay['position']; style?: React.CSSProperties; children: React.ReactNode }> = ({
  position,
  style,
  children,
}) => (
  <AbsoluteFill style={{ pointerEvents: 'none' }}>
    <div style={{ position: 'absolute', ...POS[position], transform: 'translate(-50%, -50%)', ...style }}>
      {children}
    </div>
  </AbsoluteFill>
);

export const Stamp: React.FC<Props> = ({ overlay, look, durationFrames }) => {
  const { frame, fps, exit } = useInOut(durationFrames, look, 6);
  const u = useUnit();
  const slam = spring({ frame, fps, config: { damping: 12, stiffness: 260, mass: 0.6 } });
  const shake = frame < 8 ? Math.sin(frame * 2.4) * (8 - frame) * 0.8 * u : 0;
  const tilt = (rand(overlay.id, 1) - 0.5) * 14;
  const size = 96 * u;
  return (
    <Anchor position={overlay.position}>
      <div
        style={{
          fontFamily: fontFamily(look.fonts.heading),
          fontSize: size,
          fontWeight: 900,
          lineHeight: 1,
          whiteSpace: 'nowrap',
          textTransform: 'uppercase',
          color: '#FFFFFF',
          padding: `${size * 0.14}px ${size * 0.26}px`,
          border: `${8 * u}px solid #FFFFFF`,
          background: 'rgba(0,0,0,0.12)',
          outline: `${3 * u}px solid ${look.colors.primary}`,
          outlineOffset: `${6 * u}px`,
          textShadow: textShadow(u),
          transform: `translateX(${shake}px) rotate(${tilt}deg) scale(${interpolate(slam, [0, 1], [2.2, 1])})`,
          opacity: Math.min(1, slam * 2) * exit,
        }}
      >
        {overlay.text}
      </div>
    </Anchor>
  );
};

export const ColorCard: React.FC<Props> = ({ overlay, look, durationFrames }) => {
  const { enter, exit } = useInOut(durationFrames, look, 7);
  const u = useUnit();
  const ink = readableOn(look.colors.primary);
  const size = (overlay.text.length > 24 ? 84 : 118) * u;
  return (
    <AbsoluteFill style={{ pointerEvents: 'none', justifyContent: 'center', alignItems: 'center' }}>
      <div
        style={{
          width: '74%',
          aspectRatio: '3 / 4.2',
          maxHeight: '72%',
          background: look.colors.primary,
          borderRadius: 18 * u,
          boxShadow: `0 ${20 * u}px ${60 * u}px rgba(0,0,0,0.45)`,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          padding: 60 * u,
          transform: `translateY(${(1 - enter) * 900 * u + (1 - exit) * 900 * u}px) rotate(${(1 - enter) * -8 + 2}deg)`,
        }}
      >
        <div style={{ fontFamily: fontFamily(look.fonts.note), fontSize: size, color: ink, textAlign: 'center', lineHeight: 1.05 }}>
          {overlay.text}
        </div>
        {overlay.subtext ? (
          <div style={{ fontFamily: fontFamily(look.fonts.caption), fontSize: 40 * u, color: ink, opacity: 0.7, marginTop: 30 * u, textAlign: 'center' }}>
            {overlay.subtext}
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};

export const Note: React.FC<Props> = ({ overlay, look, durationFrames }) => {
  const { frame, fps, enter, exit } = useInOut(durationFrames, look);
  const u = useUnit();
  const draw = spring({ frame: frame - 4, fps, config: { damping: 200, stiffness: 60 } });
  const size = 58 * u;
  const w = Math.max(260, overlay.text.length * 30 + 120) * u;
  const h = 170 * u;
  const position = overlay.position === 'center' ? 'right' : overlay.position;
  return (
    <Anchor position={position} style={{ width: w, height: h, opacity: exit }}>
      <svg width={w} height={h} viewBox="0 0 100 50" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
        <path
          d="M 8 30 C 4 10, 40 2, 70 5 C 98 8, 100 38, 70 45 C 40 50, 6 46, 10 22"
          fill="none"
          stroke={look.colors.primary}
          strokeWidth={1.6}
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
          style={{ strokeWidth: 7 * u }}
          pathLength={1}
          strokeDasharray={1}
          strokeDashoffset={1 - draw}
        />
      </svg>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: fontFamily(look.fonts.note),
          fontSize: size,
          color: '#FFFFFF',
          textShadow: textShadow(u),
          transform: `rotate(-4deg) scale(${0.7 + 0.3 * enter})`,
          opacity: enter,
        }}
      >
        {overlay.text}
      </div>
    </Anchor>
  );
};

export const Emoji: React.FC<Props> = ({ overlay, look, durationFrames }) => {
  const { frame, fps, exit } = useInOut(durationFrames, look, 6);
  const u = useUnit();
  const pop = spring({ frame, fps, config: { damping: 8, stiffness: 200, mass: 0.6 } });
  const wobble = Math.sin(frame / 4) * 6;
  return (
    <Anchor position={overlay.position === 'center' ? 'top' : overlay.position}>
      <div style={{ fontSize: 190 * u, lineHeight: 1, transform: `scale(${pop * exit}) rotate(${wobble}deg)` }}>{overlay.text}</div>
    </Anchor>
  );
};

/** Floating app-style window card ("screen behind you"). */
export const Card: React.FC<Props> = ({ overlay, look, durationFrames }) => {
  const { enter, exit } = useInOut(durationFrames, look);
  const u = useUnit();
  return (
    <Anchor position={overlay.position === 'center' ? 'top' : overlay.position}>
      <div
        style={{
          width: 760 * u,
          background: 'rgba(22,22,24,0.94)',
          border: `${2 * u}px solid rgba(255,255,255,0.08)`,
          borderRadius: 28 * u,
          padding: 36 * u,
          boxShadow: `0 ${30 * u}px ${80 * u}px rgba(0,0,0,0.55)`,
          transform: `translateY(${(1 - enter) * 60 * u}px) scale(${0.9 + 0.1 * enter})`,
          opacity: enter * exit,
        }}
      >
        <div style={{ display: 'flex', gap: 10 * u, marginBottom: 26 * u }}>
          {['#FF5F57', '#FEBC2E', '#28C840'].map((c) => (
            <div key={c} style={{ width: 18 * u, height: 18 * u, borderRadius: 9 * u, background: c }} />
          ))}
        </div>
        <div style={{ height: 10 * u, width: '40%', borderRadius: 5 * u, background: look.colors.accent, marginBottom: 22 * u }} />
        <div style={{ fontFamily: fontFamily(look.fonts.heading), fontSize: 54 * u, color: '#FFFFFF', lineHeight: 1.1 }}>{overlay.text}</div>
        {overlay.subtext ? (
          <div style={{ fontFamily: fontFamily(look.fonts.caption), fontSize: 34 * u, color: 'rgba(255,255,255,0.65)', marginTop: 16 * u, lineHeight: 1.3 }}>
            {overlay.subtext}
          </div>
        ) : (
          <>
            <div style={{ height: 14 * u, width: '90%', borderRadius: 7 * u, background: 'rgba(255,255,255,0.12)', marginTop: 24 * u }} />
            <div style={{ height: 14 * u, width: '70%', borderRadius: 7 * u, background: 'rgba(255,255,255,0.12)', marginTop: 14 * u }} />
          </>
        )}
      </div>
    </Anchor>
  );
};

export const OVERLAY_COMPONENTS: Record<Overlay['type'], React.FC<Props>> = {
  stamp: Stamp,
  colorCard: ColorCard,
  note: Note,
  emoji: Emoji,
  card: Card,
};
