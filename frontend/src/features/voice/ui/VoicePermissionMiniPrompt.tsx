import { useI18n } from '@/shared/lib/i18n';

type VoicePermissionMiniPromptProps = {
  wakeName: string;
  isPriming: boolean;
  permissionState?: PermissionState | 'unsupported' | 'unknown';
  placement?: 'floating' | 'chat';
  onPrime: () => void;
  onClose: () => void;
};

export function VoicePermissionMiniPrompt({
  wakeName,
  isPriming,
  permissionState = 'unknown',
  placement = 'floating',
  onPrime,
  onClose,
}: VoicePermissionMiniPromptProps) {
  const { t } = useI18n();
  const denied = permissionState === 'denied';
  const unsupported = permissionState === 'unsupported';

  return (
    <div className="voice-permission-mini" data-placement={placement} data-no-swipe="true" role="dialog" aria-modal="false" aria-label={t('voiceMini.aria')}>
      <div className="voice-permission-mini__mark" aria-hidden="true">♪</div>
      <div className="voice-permission-mini__copy">
        <strong>{denied ? t('voiceMini.title.denied') : t('voiceMini.title', { name: wakeName })}</strong>
        <span>{unsupported ? t('voiceMini.unsupported') : denied ? t('voiceMini.denied') : t('voiceMini.caption')}</span>
      </div>
      <div className="voice-permission-mini__actions">
        <button type="button" onClick={onPrime} disabled={isPriming || unsupported}>{isPriming ? t('voiceIntro.action.loading') : denied ? t('voiceIntro.action.retry') : t('voiceIntro.action.allow')}</button>
        <button type="button" className="voice-permission-mini__close" onClick={onClose} aria-label={t('common.close')}>×</button>
      </div>
    </div>
  );
}
