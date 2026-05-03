import { forwardRef, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/shared/lib/cn';

type TextFieldProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

export const TextField = forwardRef<HTMLTextAreaElement, TextFieldProps>(
  function TextField({ className, ...props }, ref) {
    return (
      <textarea
        ref={ref}
        className={cn(
          'min-h-[72px] w-full resize-none rounded-2xl border border-white/10 bg-black/24 px-4 py-3 text-base text-white outline-none placeholder:text-white/32 focus:border-emerald-300/35 focus:bg-black/30',
          className,
        )}
        {...props}
      />
    );
  },
);