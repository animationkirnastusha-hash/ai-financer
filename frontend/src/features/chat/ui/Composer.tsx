import { useState } from 'react';
import { Button, TextField } from '@/shared/ui';

type ComposerProps = {
  onSend: (text: string) => Promise<void>;
  disabled?: boolean;
};

export function Composer({ onSend, disabled = false }: ComposerProps) {
  const [value, setValue] = useState('');

  const handleSend = async () => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;

    setValue('');
    await onSend(trimmed);
  };

  return (
    <div className="border-t border-white/8 p-4 pb-[calc(16px+env(safe-area-inset-bottom))]">
      <div className="flex items-end gap-3">
        <TextField
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="Напиши, что нужно сделать..."
          rows={1}
        />
        <Button onClick={handleSend} disabled={disabled}>
          Send
        </Button>
      </div>
    </div>
  );
}