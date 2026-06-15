import { useEffect, useMemo, useState } from 'react';

type AssistantTypingTextProps = {
  text: string;
  enabled?: boolean;
};

const MIN_DURATION_MS = 420;
const MAX_DURATION_MS = 1700;
const MS_PER_CHARACTER = 22;

function easeOutCubic(progress: number) {
  return 1 - Math.pow(1 - progress, 3);
}

export function AssistantTypingText({ text, enabled = false }: AssistantTypingTextProps) {
  const characters = useMemo(() => Array.from(text), [text]);
  const [visibleCount, setVisibleCount] = useState(() => (enabled ? 0 : characters.length));

  useEffect(() => {
    if (!enabled || characters.length === 0) {
      setVisibleCount(characters.length);
      return;
    }

    let frame = 0;
    let startAt = 0;
    const duration = Math.min(
      MAX_DURATION_MS,
      Math.max(MIN_DURATION_MS, characters.length * MS_PER_CHARACTER),
    );

    setVisibleCount(0);

    const tick = (timestamp: number) => {
      if (!startAt) startAt = timestamp;
      const progress = Math.min(1, (timestamp - startAt) / duration);
      const nextCount = Math.min(
        characters.length,
        Math.max(1, Math.ceil(easeOutCubic(progress) * characters.length)),
      );

      setVisibleCount(nextCount);

      if (progress < 1) {
        frame = window.requestAnimationFrame(tick);
      }
    };

    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [characters, enabled]);

  const visibleText = characters.slice(0, visibleCount).join('');
  const isTyping = enabled && visibleCount < characters.length;

  return (
    <span className="assistant-typing-text" data-typing={isTyping ? 'true' : 'false'}>
      {visibleText}
      {isTyping ? <span className="assistant-typing-text__cursor" aria-hidden="true" /> : null}
    </span>
  );
}
