import { useEffect, useRef, useState } from 'react';
import type { ChatMessage } from '../../shared/schema';
import { Button, cx, Icon, Spinner } from './ui';

/** Claude replies use light markdown: render **bold** and `code`, keep line breaks. */
function Rich({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith('**') && p.endsWith('**') ? (
          <strong key={i} className="font-semibold">{p.slice(2, -2)}</strong>
        ) : p.startsWith('`') && p.endsWith('`') ? (
          <code key={i} className="rounded bg-black/30 px-1 text-[0.92em]">{p.slice(1, -1)}</code>
        ) : (
          p
        ),
      )}
    </>
  );
}

const QUICK = [
  'Make it punchier: tighter cuts, faster pace',
  'Write a stronger hook',
  'Add more graphics on the key points',
  'Cut it down to under 30 seconds',
  'Fix any mis-heard words in the captions',
  'Make it calmer, fewer graphics',
];

export function ChatPanel({
  chat,
  running,
  disabled,
  onSend,
  onStop,
}: {
  chat: ChatMessage[];
  running: boolean;
  disabled?: boolean;
  onSend: (text: string) => Promise<void>;
  onStop: () => void;
}) {
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const list = useRef<HTMLDivElement>(null);

  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight, behavior: 'smooth' });
  }, [chat.length, running]);

  const send = async (msg: string) => {
    if (!msg.trim() || running) return;
    setError('');
    try {
      await onSend(msg.trim());
      setText('');
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div ref={list} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {chat.length === 0 && (
          <div className="rounded-xl border border-line bg-raised/50 p-4 text-sm text-muted">
            Tell Claude what you want, like you'd brief an editor. It cuts, writes the hook, picks the key words and adds graphics in
            your look. Every change is saved as a version you can go back to.
          </div>
        )}
        {chat.map((m) =>
          m.role === 'tool' ? (
            <div key={m.id} className="flex items-center gap-2 pl-1 text-xs text-dim">
              <span className="h-1 w-1 rounded-full bg-dim" /> {m.text}
            </div>
          ) : m.role === 'system' ? (
            <div key={m.id} className="rounded-lg bg-white/[0.03] px-3 py-2 text-xs text-muted">{m.text}</div>
          ) : (
            <div key={m.id} className={cx('flex', m.role === 'you' && 'justify-end')}>
              <div
                className={cx(
                  'max-w-[88%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed',
                  m.role === 'you' ? 'rounded-br-md bg-brand text-black' : 'rounded-bl-md bg-raised text-fg',
                )}
              >
                {m.role === 'claude' ? <Rich text={m.text.replace(/^- /gm, '• ')} /> : m.text}
              </div>
            </div>
          ),
        )}
        {running && (
          <div className="flex items-center gap-2 text-sm text-brand">
            <Spinner /> Claude is editing…
          </div>
        )}
      </div>
      <div className="space-y-2 border-t border-line p-3">
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {QUICK.map((q) => (
            <button
              key={q}
              disabled={running || disabled}
              onClick={() => send(q)}
              className="shrink-0 rounded-full border border-line px-2.5 py-1 text-xs text-muted transition-colors hover:border-[#3a3a40] hover:text-fg disabled:opacity-40"
            >
              {q}
            </button>
          ))}
        </div>
        {error && <p className="text-xs text-danger">{error}</p>}
        <div className="flex items-end gap-2">
          <textarea
            rows={2}
            value={text}
            disabled={disabled}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                send(text);
              }
            }}
            placeholder={disabled ? 'Waiting for the video to finish processing…' : 'Ask Claude for an edit… (Enter to send)'}
            className="min-h-[44px] flex-1 resize-none rounded-xl border border-line bg-bg px-3 py-2.5 text-sm placeholder:text-dim focus:border-[#45454c] focus:outline-none"
          />
          {running ? (
            <Button onClick={onStop} title="Stop Claude"><Icon name="stop" /></Button>
          ) : (
            <Button variant="primary" disabled={!text.trim() || disabled} onClick={() => send(text)} title="Send">
              <Icon name="send" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
