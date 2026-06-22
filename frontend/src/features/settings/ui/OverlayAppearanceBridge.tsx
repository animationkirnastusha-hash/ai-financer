import { useEffect } from 'react';
import { useSettingsStore } from '@/features/settings/model/settings.store';

function clampDensity(value: number): number {
  if (!Number.isFinite(value)) return 68;
  return Math.min(90, Math.max(40, Math.round(value)));
}

function toAlpha(value: number): number {
  return clampDensity(value) / 100;
}

export function OverlayAppearanceBridge() {
  const finaOverlayDensity = useSettingsStore((state) => state.finaOverlayDensity);

  useEffect(() => {
    const root = document.documentElement;
    const density = clampDensity(finaOverlayDensity);
    const scrimAlpha = toAlpha(density);
    const stageTopAlpha = Math.min(0.96, scrimAlpha + 0.10);
    const stageBottomAlpha = Math.min(0.98, scrimAlpha + 0.16);
    const composerAlpha = Math.min(0.96, scrimAlpha + 0.18);

    root.style.setProperty('--fina-overlay-density-percent', String(density));
    root.style.setProperty('--fina-overlay-scrim-alpha', scrimAlpha.toFixed(2));
    root.style.setProperty('--fina-overlay-stage-top-alpha', stageTopAlpha.toFixed(2));
    root.style.setProperty('--fina-overlay-stage-bottom-alpha', stageBottomAlpha.toFixed(2));
    root.style.setProperty('--fina-overlay-composer-alpha', composerAlpha.toFixed(2));
    root.dataset.finaOverlayDensity = String(density);

    return () => {
      root.style.removeProperty('--fina-overlay-density-percent');
      root.style.removeProperty('--fina-overlay-scrim-alpha');
      root.style.removeProperty('--fina-overlay-stage-top-alpha');
      root.style.removeProperty('--fina-overlay-stage-bottom-alpha');
      root.style.removeProperty('--fina-overlay-composer-alpha');
      delete root.dataset.finaOverlayDensity;
    };
  }, [finaOverlayDensity]);

  return null;
}
