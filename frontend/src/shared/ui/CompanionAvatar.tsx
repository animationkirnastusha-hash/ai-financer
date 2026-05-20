import { useState } from 'react';

type Props = {
  mood?: 'calm' | 'focused' | 'listening' | 'thinking' | 'warning' | string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
};

const sizeClass = {
  sm: 'h-10 w-10',
  md: 'h-14 w-14',
  lg: 'h-24 w-24',
};

function getMoodClass(mood: Props['mood']) {
  if (mood === 'warning') return 'ai-companion-avatar--warning';
  if (mood === 'listening') return 'ai-companion-avatar--listening';
  if (mood === 'thinking' || mood === 'focused') return 'ai-companion-avatar--focused';
  return 'ai-companion-avatar--calm';
}

export function CompanionAvatar({ mood = 'calm', size = 'md', className = '' }: Props) {
  const [videoAvailable, setVideoAvailable] = useState(true);

  return (
    <span className={`ai-companion-avatar ${getMoodClass(mood)} ${sizeClass[size]} ${className}`} aria-hidden="true">
      {videoAvailable ? (
        <video
          className="ai-companion-avatar__video"
          src="/companion/companion.webm"
          autoPlay
          loop
          muted
          playsInline
          preload="metadata"
          onError={() => setVideoAvailable(false)}
        />
      ) : null}

      <span className="ai-companion-avatar__fallback">
        <span className="ai-companion-avatar__halo" />
        <span className="ai-companion-avatar__head">
          <span className="ai-companion-avatar__eyes">
            <span />
            <span />
          </span>
          <span className="ai-companion-avatar__mouth" />
        </span>
        <span className="ai-companion-avatar__body" />
      </span>
    </span>
  );
}
