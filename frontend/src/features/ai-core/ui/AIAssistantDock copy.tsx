import { CompanionPresence } from '@/features/companion/ui/CompanionPresence';

type Props = {
  onOpen?: () => void;
};

export function AIAssistantDock({ onOpen }: Props) {
  return (
    <div onClick={onOpen} className="ai-assistant-dock">
      <CompanionPresence compact />
    </div>
  );
}
