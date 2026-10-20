# Vibe Edit

A personal, dark, minimal web app for editing **talking-head reels with Claude**. Upload raw clips; Claude Code cuts the pauses and bad takes, writes the hook, picks the key words for captions and adds graphics in your own look. You fine-tune in a live preview and export a 1080p MP4 for Instagram, TikTok, YouTube Shorts or YouTube.

```
Upload ─► ffmpeg proxy ─► whisper.cpp transcript ─► instant auto-cut
                                                    │
                     You ◄─► Claude chat (claude -p edits edit.json) ─► new version
                                                    │
                 Live Remotion preview ◄── edit plan (JSON) ──► Remotion render ─► MP4
```

Claude never touches the video. It edits a small JSON **edit plan** (which ranges to keep, the hook, the highlighted words, timed graphics, zooms). The browser plays that plan instantly with Remotion, so tweaks are live and only the final export takes render time.

## What's in it

**Phase 1: upload → Claude edit → export**
- Drag-and-drop upload (several clips at once = batch edit with the same look and brief)
- iPhone HEVC/MOV handled: everything is converted to an H.264 proxy
- Free on-server transcription with word timings (whisper.cpp), or OpenAI if you prefer
- Instant auto-cut (pauses removed, captions on, hook from your first line) before Claude even starts
- Claude chat per video with live progress, quick prompts and a stop button; Claude keeps the conversation context between messages
- 1080p H.264 render queue with progress, downloads and an export list

**Phase 2: Look builder (like the reel)**
- 7 steps: Colours → Fonts → Hook → Captions → Elements → Motion → Review
- Every option is shown rendered on a frame of *your own* footage
- 5 preset looks to start from (Ransom Note, Clean Creator, Hype, Editorial Serif, Bold Box); duplicate and customise
- 20 bundled fonts, 5 hook styles, 5 caption styles, 5 elements (stamp word, colour card, handwritten note, emoji pop, app-screen card), punch-in zooms, flashes, progress bar

**Phase 3: fine-tuning studio**
- Transcript editor: drag across words to cut/restore them, click pauses to keep or cut them, double-click to fix spelling, turn selected words into a stamp/card/note in one click
- Timeline with clips, hook, elements, zooms and captions; drag to move, drag the edge to resize
- Design panel: hook text and highlights, **hook ideas from Claude**, caption style per video, add elements at the playhead, motion toggles
- Undo/redo, autosave, full version history (every Claude edit and every render is restorable)
- **Your editing system**: house rules in Settings that Claude follows on every edit

## Run it on your computer

Needs Node 22+, ffmpeg, `make`/`g++`/`cmake` (for whisper.cpp), and Claude Code signed in (`claude` works in your terminal).

```bash
npm install
npm run dev          # web app on http://localhost:5173, API on :8787
```

The first upload builds whisper.cpp and downloads the speech model (a few minutes, once). Data lives in `./data`.

## Put it in the cloud

Any Linux server with Docker works. Rendering is CPU-heavy, so **4 vCPU / 8 GB RAM** is a comfortable minimum (e.g. Hetzner CPX31, DigitalOcean 8 GB, a Railway/Render service with a volume).

1. **Get a Claude token for your subscription.** On your own computer run:
   ```bash
   claude setup-token
   ```
   Copy the token it prints. The server uses it to run Claude Code headlessly with your plan (usage counts against your normal Claude limits).
2. **On the server:**
   ```bash
   git clone <this repo> vibe-edit && cd vibe-edit
   cp .env.example .env    # set APP_PASSWORD and CLAUDE_CODE_OAUTH_TOKEN
   docker compose up -d --build
   ```
   Open `http://<server-ip>:8787` and sign in with your password.
3. **HTTPS on your domain (recommended):** point a DNS A record at the server, set `DOMAIN=edit.yourdomain.com` in `.env`, then:
   ```bash
   docker compose --profile https up -d
   ```
   Once HTTPS works, remove the `8787:8787` port mapping from `docker-compose.yml` so the app is only reachable through Caddy.

Everything (videos, transcripts, looks, Claude sessions, renders) is stored in the `vibe-data` Docker volume.

## Settings (environment variables)

| Variable | What it does |
|---|---|
| `APP_PASSWORD` | Dashboard password. Without it anyone who can reach the server can use it. |
| `CLAUDE_CODE_OAUTH_TOKEN` | Your subscription token from `claude setup-token`. (`ANTHROPIC_API_KEY` also works if you'd rather pay per use.) |
| `CLAUDE_MODEL` | Model for edits, e.g. `opus` or `sonnet`. Blank = Claude Code default. Also settable in the app. |
| `WHISPER_MODEL` | `tiny`, `base`, `small` (default), `medium`, `large-v3-turbo`; `.en` variants are faster for English only. |
| `WHISPER_LANGUAGE` | `auto` (default) or a language code like `en`, `hi`. |
| `OPENAI_API_KEY` | Optional: transcribe with OpenAI's API instead of whisper.cpp. |
| `RENDER_CONCURRENCY` | Optional: browser tabs used per render (defaults to half your CPU cores). |

## Make Claude edit your way

- **Settings → Your editing system**: plain-English house rules (audience, tone, length, what to always/never cut, brand spellings). Sent with every edit.
- **Looks**: which elements Claude is allowed to use and how everything looks.
- **`server/prompts/editor.md`**: the built-in talking-head editing playbook and the edit-plan format, if you want to change Claude's defaults.

## Project layout

```
server/            Express API: uploads, ffmpeg, whisper, Claude runner, renders
  prompts/editor.md  Claude's editing instructions
src/shared/        Edit-plan schema (zod), timeline maths, preset looks
src/remotion/      The video itself: hook, captions, elements, zooms (Remotion)
src/client/        The dashboard (React + Tailwind)
```

`npm test` runs the timeline/edit-format tests; `npm run typecheck` checks types.

## Ideas for next phases

- Auto-posting to Instagram/TikTok/YouTube (needs each platform's developer app and API keys)
- Long video → several short clips (Claude picks the best moments)
- B-roll and screen-recording inserts, music bed with auto-ducking, sound effects on graphics
- Remove background behind you for "screen behind you" shots (needs a segmentation model)
- "More like this" variations of an element or a whole edit
