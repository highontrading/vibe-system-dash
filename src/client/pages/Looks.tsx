import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, type LookWithMeta } from '../api';
import { DEMO_STILL, demoPlan } from '../demo';
import { LookThumb } from '../components/LookThumb';
import { Button, Icon } from '../components/ui';
import { FONT_FAMILY } from '../../remotion/fonts';
import { PRESET_LOOKS } from '../../shared/looks';

export function Looks() {
  const [looks, setLooks] = useState<LookWithMeta[]>([]);
  const refresh = () => api.looks().then(setLooks);
  useEffect(() => {
    refresh();
  }, []);

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-6 sm:px-8 sm:py-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl sm:text-5xl">Looks</h1>
          <p className="mt-1 text-sm text-muted">Your brand kits: colours, fonts, hook, captions, elements and motion. Claude edits in the look you pick.</p>
        </div>
        <Link to="/looks/new">
          <Button variant="primary"><Icon name="plus" /> New look</Button>
        </Link>
      </header>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {looks.map((look) => {
          const isOverride = !look.preset && PRESET_LOOKS.some((p) => p.id === look.id);
          return (
            <div key={look.id} className="overflow-hidden rounded-xl border border-line bg-panel">
              <Link to={`/looks/${look.id}`} className="block aspect-[9/14] overflow-hidden bg-raised">
                <LookThumb plan={demoPlan(look)} still={DEMO_STILL} atSec={1.5} className="h-full w-full" />
              </Link>
              <div className="space-y-2 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="truncate text-sm font-semibold">{look.name}</div>
                  {look.preset && <span className="rounded bg-raised px-1.5 py-0.5 text-[10px] text-muted">Preset</span>}
                </div>
                <div className="flex items-center gap-1">
                  {[look.colors.primary, look.colors.accent, look.colors.text].map((c, i) => (
                    <span key={i} className="h-3.5 w-3.5 rounded-full border border-white/10" style={{ background: c }} />
                  ))}
                  <span className="ml-1 truncate text-[11px] text-dim">{FONT_FAMILY[look.fonts.heading]}</span>
                </div>
                <div className="flex gap-1">
                  <Link to={`/looks/${look.id}`}><Button size="sm">Edit</Button></Link>
                  <Link to={`/looks/new?from=${look.id}`}><Button size="sm" variant="ghost">Duplicate</Button></Link>
                  {!look.preset && (
                    <Button
                      size="sm"
                      variant="ghost"
                      title={isOverride ? 'Reset to the original preset' : 'Delete'}
                      onClick={() => window.confirm(isOverride ? `Reset “${look.name}” to the preset?` : `Delete “${look.name}”?`) && api.deleteLook(look.id).then(refresh)}
                    >
                      {isOverride ? 'Reset' : <Icon name="trash" className="h-3.5 w-3.5" />}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
