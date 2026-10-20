import type { Overlay } from './schema';

export const ELEMENT_INFO: Record<Overlay['type'], { label: string; description: string; sample: Partial<Overlay> }> = {
  stamp: { label: 'Stamp word', description: 'A bold stamped word or number', sample: { text: '7 POSTS', position: 'right' } },
  colorCard: { label: 'Colour card', description: 'A full colour card with a few words', sample: { text: 'the dream', position: 'center' } },
  note: { label: 'Handwritten note', description: 'A note in a hand-drawn ring by your shoulder', sample: { text: 'film once', position: 'left' } },
  emoji: { label: 'Emoji pop', description: 'A big bouncing emoji reaction', sample: { text: '🤯', position: 'top' } },
  card: { label: 'App screen', description: 'A floating app window with a title', sample: { text: 'My content system', subtext: '3 videos a week, 1 hour of work', position: 'top' } },
};
