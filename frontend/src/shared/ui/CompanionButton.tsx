import type { ButtonHTMLAttributes } from 'react';
import { CompanionAvatar } from '@/shared/ui/CompanionAvatar';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  mood?: string;
  size?: 'sm' | 'md' | 'lg';
  label?: string;
};

const sizes = {
  sm: 'h-12 w-12',
  md: 'h-16 w-16',
  lg: 'h-28 w-28',
};

export function CompanionButton({
  mood = 'calm',
  size = 'md',
  label = 'Открыть AI',
  className = '',
  ...props
}: Props) {
  return (
    <button
      type="button"
      aria-label={label}
      className={`ai-companion-control relative grid ${sizes[size]} place-items-center overflow-visible rounded-full transition active:scale-[0.97] ${className}`}
      draggable={false}
      data-no-swipe="true"
      {...props}
    >
      <CompanionAvatar mood={mood} size={size} />
    </button>
  );
}
