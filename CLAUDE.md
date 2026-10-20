# Vibe Edit: notes for Claude

Personal dashboard for editing talking-head social videos with Claude. See README.md for the product overview.

## Commands

- `npm run dev`: API (tsx watch, :8787) + Vite (:5173, proxies /api and /media)
- `npm test`: node:test suite for `src/shared`
- `npm run typecheck`
- `npm run build`: builds the web app into `dist/` (served by the API in production)

## Architecture

- **Edit plan** (`src/shared/schema.ts` → `EditPlan`) is the single source of truth for a video's edit. All times are SOURCE seconds; `src/shared/timeline.ts` maps them to output time through the kept `segments`.
- **Remotion composition** (`src/remotion/EditComposition.tsx`) renders a plan. The same component runs in the browser `<Player>` (preview) and in `@remotion/renderer` (export), so preview = render.
- **Claude** runs as `claude -p` (server/claude.ts) in `data/projects/<id>/work/`, editing a compact `edit.json` (`src/shared/claudeEdit.ts`) plus `words.txt` and `brief.md`. The server validates it with zod and turns it into a new plan version. Instructions: `server/prompts/editor.md`.
- **Storage** is plain JSON files under `DATA_DIR` (server/store.ts); no database.
- Fonts are bundled from Fontsource (`src/remotion/fonts.ts`) so renders never need Google Fonts.

## Conventions

- Adding an overlay element: add the type to `ELEMENT_TYPES` (schema), a component in `src/remotion/elements/Overlays.tsx` + `OVERLAY_COMPONENTS`, an entry in `src/shared/elements.ts`, and describe it in `server/prompts/editor.md`.
- Keep the plan format backward compatible, or bump `version` and migrate old plans.
