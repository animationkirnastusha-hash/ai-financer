import { VoicePermissionIntro } from '@/features/voice/ui/VoicePermissionIntro';
import { VoiceStatusPill } from '@/features/voice/ui/VoiceStatusPill';
import { VoiceThoughtBubble } from '@/features/voice/ui/VoiceThoughtBubble';
import { CompanionButton } from '@/shared/ui/CompanionButton';
import type { VoiceCompanionSurfaceProps } from '@/features/voice/ui/companion/voiceCompanion.types';

export function VoiceCompanionSurface({
  needsIntro,
  showFloatingCompanion,
  wakeName,
  isPriming,
  permissionState,
  onPrimePermission,
  onSkipPermissionIntro,
  thought,
  canUseVoice,
  isBusy,
  voiceState,
  captureMode,
  phase,
  cooldownUntil,
  mood,
  gestureMode,
  ariaLabel,
  tapToTextEnabled = true,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
}: VoiceCompanionSurfaceProps) {
  if (!showFloatingCompanion && !needsIntro) return null;

  return (
    <>
      {needsIntro ? (
        <VoicePermissionIntro
          wakeName={wakeName}
          isPriming={isPriming}
          permissionState={permissionState}
          onPrime={onPrimePermission}
          onSkip={onSkipPermissionIntro}
        />
      ) : null}

      {showFloatingCompanion ? (
        <div
          className={voiceState === 'recording' || gestureMode === 'holding' ? 'voice-first-companion voice-first-companion--manual-active' : 'voice-first-companion'}
          data-no-swipe="true"
          data-voice-state={voiceState}
          data-gesture-mode={gestureMode}
        >
          <VoiceThoughtBubble thought={thought} />

          <div className="voice-first-companion__controls">
            <div className="voice-first-companion__voice-panel">
              <VoiceStatusPill
                canUseVoice={canUseVoice}
                isBusy={isBusy}
                voiceState={voiceState}
                captureMode={captureMode}
                phase={phase}
                cooldownUntil={cooldownUntil}
                tapToTextEnabled={tapToTextEnabled}
              />
            </div>

            <div
              className="voice-first-companion__press-target"
              role="button"
              aria-label={ariaLabel}
              tabIndex={0}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerCancel}
              onContextMenu={(event) => event.preventDefault()}
            >
              <CompanionButton
                mood={mood}
                size="md"
                label={ariaLabel}
                className="pointer-events-none select-none"
                tabIndex={-1}
                aria-hidden="true"
              />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
