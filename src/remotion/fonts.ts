import { continueRender, delayRender } from 'remotion';
import { loadFont } from '@remotion/fonts';
import type { FontName } from '../shared/schema';

// Fonts are bundled with the app (Fontsource, latin subset) so rendering never
// depends on reaching Google Fonts from the server.
import Inter400 from '@fontsource/inter/files/inter-latin-400-normal.woff2';
import Inter700 from '@fontsource/inter/files/inter-latin-700-normal.woff2';
import Inter800 from '@fontsource/inter/files/inter-latin-800-normal.woff2';
import Inter900 from '@fontsource/inter/files/inter-latin-900-normal.woff2';
import Montserrat400 from '@fontsource/montserrat/files/montserrat-latin-400-normal.woff2';
import Montserrat700 from '@fontsource/montserrat/files/montserrat-latin-700-normal.woff2';
import Montserrat800 from '@fontsource/montserrat/files/montserrat-latin-800-normal.woff2';
import Montserrat900 from '@fontsource/montserrat/files/montserrat-latin-900-normal.woff2';
import Poppins400 from '@fontsource/poppins/files/poppins-latin-400-normal.woff2';
import Poppins700 from '@fontsource/poppins/files/poppins-latin-700-normal.woff2';
import Poppins800 from '@fontsource/poppins/files/poppins-latin-800-normal.woff2';
import Poppins900 from '@fontsource/poppins/files/poppins-latin-900-normal.woff2';
import DMSans400 from '@fontsource/dm-sans/files/dm-sans-latin-400-normal.woff2';
import DMSans700 from '@fontsource/dm-sans/files/dm-sans-latin-700-normal.woff2';
import DMSans800 from '@fontsource/dm-sans/files/dm-sans-latin-800-normal.woff2';
import DMSans900 from '@fontsource/dm-sans/files/dm-sans-latin-900-normal.woff2';
import SpaceGrotesk400 from '@fontsource/space-grotesk/files/space-grotesk-latin-400-normal.woff2';
import SpaceGrotesk700 from '@fontsource/space-grotesk/files/space-grotesk-latin-700-normal.woff2';
import BricolageGrotesque400 from '@fontsource/bricolage-grotesque/files/bricolage-grotesque-latin-400-normal.woff2';
import BricolageGrotesque700 from '@fontsource/bricolage-grotesque/files/bricolage-grotesque-latin-700-normal.woff2';
import BricolageGrotesque800 from '@fontsource/bricolage-grotesque/files/bricolage-grotesque-latin-800-normal.woff2';
import Syne400 from '@fontsource/syne/files/syne-latin-400-normal.woff2';
import Syne700 from '@fontsource/syne/files/syne-latin-700-normal.woff2';
import Syne800 from '@fontsource/syne/files/syne-latin-800-normal.woff2';
import Unbounded400 from '@fontsource/unbounded/files/unbounded-latin-400-normal.woff2';
import Unbounded700 from '@fontsource/unbounded/files/unbounded-latin-700-normal.woff2';
import Unbounded800 from '@fontsource/unbounded/files/unbounded-latin-800-normal.woff2';
import Unbounded900 from '@fontsource/unbounded/files/unbounded-latin-900-normal.woff2';
import Anton400 from '@fontsource/anton/files/anton-latin-400-normal.woff2';
import BebasNeue400 from '@fontsource/bebas-neue/files/bebas-neue-latin-400-normal.woff2';
import ArchivoBlack400 from '@fontsource/archivo-black/files/archivo-black-latin-400-normal.woff2';
import Oswald400 from '@fontsource/oswald/files/oswald-latin-400-normal.woff2';
import Oswald700 from '@fontsource/oswald/files/oswald-latin-700-normal.woff2';
import InstrumentSerif400 from '@fontsource/instrument-serif/files/instrument-serif-latin-400-normal.woff2';
import PlayfairDisplay400 from '@fontsource/playfair-display/files/playfair-display-latin-400-normal.woff2';
import PlayfairDisplay700 from '@fontsource/playfair-display/files/playfair-display-latin-700-normal.woff2';
import PlayfairDisplay800 from '@fontsource/playfair-display/files/playfair-display-latin-800-normal.woff2';
import PlayfairDisplay900 from '@fontsource/playfair-display/files/playfair-display-latin-900-normal.woff2';
import DMSerifDisplay400 from '@fontsource/dm-serif-display/files/dm-serif-display-latin-400-normal.woff2';
import Fraunces400 from '@fontsource/fraunces/files/fraunces-latin-400-normal.woff2';
import Fraunces700 from '@fontsource/fraunces/files/fraunces-latin-700-normal.woff2';
import Fraunces800 from '@fontsource/fraunces/files/fraunces-latin-800-normal.woff2';
import Fraunces900 from '@fontsource/fraunces/files/fraunces-latin-900-normal.woff2';
import Caveat400 from '@fontsource/caveat/files/caveat-latin-400-normal.woff2';
import Caveat700 from '@fontsource/caveat/files/caveat-latin-700-normal.woff2';
import Kalam400 from '@fontsource/kalam/files/kalam-latin-400-normal.woff2';
import Kalam700 from '@fontsource/kalam/files/kalam-latin-700-normal.woff2';
import PermanentMarker400 from '@fontsource/permanent-marker/files/permanent-marker-latin-400-normal.woff2';
import SpecialElite400 from '@fontsource/special-elite/files/special-elite-latin-400-normal.woff2';

const FILES: Record<FontName, [number, string][]> = {
  Inter: [[400, Inter400], [700, Inter700], [800, Inter800], [900, Inter900]],
  Montserrat: [[400, Montserrat400], [700, Montserrat700], [800, Montserrat800], [900, Montserrat900]],
  Poppins: [[400, Poppins400], [700, Poppins700], [800, Poppins800], [900, Poppins900]],
  DMSans: [[400, DMSans400], [700, DMSans700], [800, DMSans800], [900, DMSans900]],
  SpaceGrotesk: [[400, SpaceGrotesk400], [700, SpaceGrotesk700]],
  BricolageGrotesque: [[400, BricolageGrotesque400], [700, BricolageGrotesque700], [800, BricolageGrotesque800]],
  Syne: [[400, Syne400], [700, Syne700], [800, Syne800]],
  Unbounded: [[400, Unbounded400], [700, Unbounded700], [800, Unbounded800], [900, Unbounded900]],
  Anton: [[400, Anton400]],
  BebasNeue: [[400, BebasNeue400]],
  ArchivoBlack: [[400, ArchivoBlack400]],
  Oswald: [[400, Oswald400], [700, Oswald700]],
  InstrumentSerif: [[400, InstrumentSerif400]],
  PlayfairDisplay: [[400, PlayfairDisplay400], [700, PlayfairDisplay700], [800, PlayfairDisplay800], [900, PlayfairDisplay900]],
  DMSerifDisplay: [[400, DMSerifDisplay400]],
  Fraunces: [[400, Fraunces400], [700, Fraunces700], [800, Fraunces800], [900, Fraunces900]],
  Caveat: [[400, Caveat400], [700, Caveat700]],
  Kalam: [[400, Kalam400], [700, Kalam700]],
  PermanentMarker: [[400, PermanentMarker400]],
  SpecialElite: [[400, SpecialElite400]],
};

export const FONT_FAMILY: Record<FontName, string> = {
  Inter: 'Inter',
  Montserrat: 'Montserrat',
  Poppins: 'Poppins',
  DMSans: 'DM Sans',
  SpaceGrotesk: 'Space Grotesk',
  BricolageGrotesque: 'Bricolage Grotesque',
  Syne: 'Syne',
  Unbounded: 'Unbounded',
  Anton: 'Anton',
  BebasNeue: 'Bebas Neue',
  ArchivoBlack: 'Archivo Black',
  Oswald: 'Oswald',
  InstrumentSerif: 'Instrument Serif',
  PlayfairDisplay: 'Playfair Display',
  DMSerifDisplay: 'DM Serif Display',
  Fraunces: 'Fraunces',
  Caveat: 'Caveat',
  Kalam: 'Kalam',
  PermanentMarker: 'Permanent Marker',
  SpecialElite: 'Special Elite',
};

const loaded = new Set<FontName>();
const pending: Partial<Record<FontName, Promise<void>>> = {};

export function fontFamily(name: FontName): string {
  return `'${FONT_FAMILY[name]}', Inter, system-ui, sans-serif`;
}

function load(name: FontName): Promise<void> {
  return (pending[name] ??= Promise.all(
    FILES[name].map(([weight, url]) => loadFont({ family: FONT_FAMILY[name], url, weight: String(weight) })),
  )
    .then(() => {
      loaded.add(name);
    })
    .catch((err) => console.warn('font failed', name, err)));
}

/** Holds the render until the fonts are ready. Call inside a composition. */
export function ensureFonts(names: FontName[]): void {
  for (const name of new Set(names)) {
    if (loaded.has(name)) continue;
    const handle = delayRender(`font ${name}`);
    load(name).finally(() => continueRender(handle));
  }
}

/** For use outside a composition (e.g. the dashboard font picker). */
export function loadFontNow(name: FontName): Promise<void> {
  return load(name);
}
