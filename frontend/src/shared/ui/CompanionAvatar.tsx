import { useMemo, useState } from 'react';

type CompanionMood =
  | 'idle'
  | 'calm'
  | 'focused'
  | 'listening'
  | 'thinking'
  | 'confirm'
  | 'success'
  | 'warning'
  | string;

type Props = {
  mood?: CompanionMood;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
};

const sizeClass = {
  sm: 'h-10 w-10',
  md: 'h-14 w-14',
  lg: 'h-28 w-28',
};

function normalizeMood(mood: CompanionMood) {
  if (mood === 'listening') return 'listening';
  if (mood === 'thinking' || mood === 'focused') return 'thinking';
  if (mood === 'confirm') return 'confirm';
  if (mood === 'success' || mood === 'positive' || mood === 'proud') return 'success';
  if (mood === 'warning') return 'warning';
  return 'idle';
}

export function CompanionAvatar({ mood = 'idle', size = 'md', className = '' }: Props) {
  const normalizedMood = normalizeMood(mood);
  const videoSrc = useMemo(() => `/companion/${normalizedMood}.webm`, [normalizedMood]);
  const [videoAvailable, setVideoAvailable] = useState(true);

  return (
    <span className={`ai-companion-avatar ai-companion-avatar--${normalizedMood} ${sizeClass[size]} ${className}`} aria-hidden="true">
      {videoAvailable ? (
        <video
          key={videoSrc}
          className="ai-companion-avatar__video"
          src={videoSrc}
          autoPlay
          loop
          muted
          playsInline
          preload="metadata"
          onError={() => setVideoAvailable(false)}
        />
      ) : null}

      <span className="ai-companion-avatar__fallback">
        <span className="ai-companion-avatar__aura" />
        <span className="ai-companion-avatar__halo" />
        <span className="ai-companion-avatar__head">
          <span className="ai-companion-avatar__visor" />
          <span className="ai-companion-avatar__eyes"><span /><span /></span>
          <span className="ai-companion-avatar__mouth" />
        </span>
        <span className="ai-companion-avatar__neck" />
        <span className="ai-companion-avatar__body" />
      </span>
    </span>
  );
}
