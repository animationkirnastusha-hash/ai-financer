import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useAppModalStore } from '@/features/modals/model/appModal.store';
import { useNavigationStore } from '@/features/navigation/model/navigation.store';
import { useOnboardingStore } from '@/features/onboarding/model/onboarding.store';
import { useProductTourStore } from '@/features/onboarding/model/productTour.store';
import { useI18n, type I18nKey } from '@/shared/lib/i18n';

type TourStep = {
  id: string;
  target: string;
  titleKey: I18nKey;
  captionKey: I18nKey;
};

type TargetRect = {
  top: number;
  left: number;
  width: number;
  height: number;
  bottom: number;
  right: number;
};

const TOUR_STEPS: TourStep[] = [
  {
    id: 'balance',
    target: 'home-balance',
    titleKey: 'onboarding.tour.balance.title',
    captionKey: 'onboarding.tour.balance.caption',
  },
  {
    id: 'fina',
    target: 'home-fina',
    titleKey: 'onboarding.tour.fina.title',
    captionKey: 'onboarding.tour.fina.caption',
  },
  {
    id: 'actions',
    target: 'home-actions',
    titleKey: 'onboarding.tour.actions.title',
    captionKey: 'onboarding.tour.actions.caption',
  },
  {
    id: 'chart',
    target: 'home-chart',
    titleKey: 'onboarding.tour.chart.title',
    captionKey: 'onboarding.tour.chart.caption',
  },
  {
    id: 'insight',
    target: 'home-insight',
    titleKey: 'onboarding.tour.insight.title',
    captionKey: 'onboarding.tour.insight.caption',
  },
];

const SPOTLIGHT_PADDING = 8;
const CARD_DEFAULT_HEIGHT = 238;
const CARD_MIN_WIDTH = 292;
const CARD_MAX_WIDTH = 342;
const CARD_GAP = 16;
const SCREEN_EDGE_GAP = 16;
const BOTTOM_UI_RESERVE = 112;

function toTargetRect(rect: DOMRect): TargetRect {
  return {
    top: rect.top,
    left: rect.left,
    width: rect.width,
    height: rect.height,
    bottom: rect.bottom,
    right: rect.right,
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function getCardStyle(targetRect: TargetRect | null, cardHeight: number): CSSProperties {
  const cardWidth = Math.min(CARD_MAX_WIDTH, Math.max(CARD_MIN_WIDTH, window.innerWidth - 32));
  const maxLeft = Math.max(SCREEN_EDGE_GAP, window.innerWidth - cardWidth - SCREEN_EDGE_GAP);
  const maxTop = Math.max(SCREEN_EDGE_GAP, window.innerHeight - BOTTOM_UI_RESERVE - cardHeight);

  if (!targetRect) {
    return {
      left: clamp((window.innerWidth - cardWidth) / 2, SCREEN_EDGE_GAP, maxLeft),
      top: maxTop,
      width: cardWidth,
    };
  }

  const left = clamp(targetRect.left + targetRect.width / 2 - cardWidth / 2, SCREEN_EDGE_GAP, maxLeft);
  const belowTop = targetRect.bottom + CARD_GAP;
  const aboveTop = targetRect.top - cardHeight - CARD_GAP;
  const canPlaceBelow = belowTop <= maxTop;
  const canPlaceAbove = aboveTop >= SCREEN_EDGE_GAP;
  const targetCenter = targetRect.top + targetRect.height / 2;
  const preferredTop = targetCenter < window.innerHeight / 2 ? belowTop : aboveTop;

  let top = preferredTop;
  if (targetCenter < window.innerHeight / 2 && !canPlaceBelow && canPlaceAbove) top = aboveTop;
  if (targetCenter >= window.innerHeight / 2 && !canPlaceAbove && canPlaceBelow) top = belowTop;
  if (!canPlaceBelow && !canPlaceAbove) top = targetCenter < window.innerHeight / 2 ? maxTop : SCREEN_EDGE_GAP;

  return {
    left,
    top: clamp(top, SCREEN_EDGE_GAP, maxTop),
    width: cardWidth,
  };
}

function getTargetElement(target: string) {
  return document.querySelector<HTMLElement>(`[data-product-tour="${target}"]`);
}

function findNearbyAvailableStep(steps: TourStep[], startIndex: number, direction: 1 | -1) {
  for (let offset = 1; offset < steps.length; offset += 1) {
    const index = startIndex + offset * direction;
    if (index < 0 || index >= steps.length) break;
    if (getTargetElement(steps[index].target)) return index;
  }
  return startIndex;
}

export function ProductTourOverlay() {
  const { t } = useI18n();
  const currentScreen = useNavigationStore((state) => state.currentScreen);
  const modalStackSize = useAppModalStore((state) => state.stack.length);
  const onboardingOpen = useOnboardingStore((state) => state.isOpen);
  const hasSeenOnboarding = useOnboardingStore((state) => state.hasSeenOnboarding);
  const isOpen = useProductTourStore((state) => state.isOpen);
  const hasSeenTour = useProductTourStore((state) => state.hasSeenTour);
  const activeStepIndex = useProductTourStore((state) => state.activeStepIndex);
  const open = useProductTourStore((state) => state.open);
  const close = useProductTourStore((state) => state.close);
  const complete = useProductTourStore((state) => state.complete);
  const setActiveStepIndex = useProductTourStore((state) => state.setActiveStepIndex);
  const [targetRect, setTargetRect] = useState<TargetRect | null>(null);
  const [cardHeight, setCardHeight] = useState(CARD_DEFAULT_HEIGHT);
  const cardRef = useRef<HTMLElement | null>(null);

  const steps = useMemo(() => TOUR_STEPS, []);
  const safeStepIndex = clamp(activeStepIndex, 0, steps.length - 1);
  const step = steps[safeStepIndex];
  const canShow = currentScreen === 'dashboard' && hasSeenOnboarding && !onboardingOpen && modalStackSize === 0;

  useEffect(() => {
    if (!canShow || hasSeenTour || isOpen) return;
    const timer = window.setTimeout(() => open(), 650);
    return () => window.clearTimeout(timer);
  }, [canShow, hasSeenTour, isOpen, open]);

  useEffect(() => {
    if (!isOpen || !canShow) return;
    document.body.classList.add('product-tour-active');
    document.documentElement.classList.add('product-tour-active');
    return () => {
      document.body.classList.remove('product-tour-active');
      document.documentElement.classList.remove('product-tour-active');
    };
  }, [canShow, isOpen]);

  useEffect(() => {
    if (!isOpen || !canShow || !step) return;

    let raf = 0;
    let timer = 0;

    const updateTarget = () => {
      window.cancelAnimationFrame(raf);
      raf = window.requestAnimationFrame(() => {
        const target = getTargetElement(step.target);
        if (!target) {
          const nextIndex = findNearbyAvailableStep(steps, safeStepIndex, 1);
          if (nextIndex !== safeStepIndex) {
            setActiveStepIndex(nextIndex);
            return;
          }
          const previousIndex = findNearbyAvailableStep(steps, safeStepIndex, -1);
          if (previousIndex !== safeStepIndex) {
            setActiveStepIndex(previousIndex);
            return;
          }
          setTargetRect(null);
          return;
        }
        setTargetRect(toTargetRect(target.getBoundingClientRect()));
      });
    };

    const target = getTargetElement(step.target);
    target?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    timer = window.setTimeout(updateTarget, 220);
    updateTarget();

    window.addEventListener('resize', updateTarget);
    window.addEventListener('scroll', updateTarget, true);
    window.visualViewport?.addEventListener('resize', updateTarget);
    window.visualViewport?.addEventListener('scroll', updateTarget);

    return () => {
      window.clearTimeout(timer);
      window.cancelAnimationFrame(raf);
      window.removeEventListener('resize', updateTarget);
      window.removeEventListener('scroll', updateTarget, true);
      window.visualViewport?.removeEventListener('resize', updateTarget);
      window.visualViewport?.removeEventListener('scroll', updateTarget);
    };
  }, [canShow, isOpen, safeStepIndex, setActiveStepIndex, step, steps]);

  useLayoutEffect(() => {
    if (!isOpen || !canShow) return;
    const nextHeight = Math.ceil(cardRef.current?.getBoundingClientRect().height ?? CARD_DEFAULT_HEIGHT);
    if (nextHeight > 0 && Math.abs(nextHeight - cardHeight) > 1) {
      setCardHeight(nextHeight);
    }
  }, [canShow, cardHeight, isOpen, safeStepIndex, step]);

  if (!isOpen || !canShow || !step) return null;

  const isFirstStep = safeStepIndex === 0;
  const isLastStep = safeStepIndex >= steps.length - 1;
  const next = () => {
    if (isLastStep) {
      complete();
      return;
    }
    setActiveStepIndex(safeStepIndex + 1);
  };
  const previous = () => setActiveStepIndex(Math.max(0, safeStepIndex - 1));

  const spotlightStyle = targetRect
    ? {
      top: targetRect.top - SPOTLIGHT_PADDING,
      left: targetRect.left - SPOTLIGHT_PADDING,
      width: targetRect.width + SPOTLIGHT_PADDING * 2,
      height: targetRect.height + SPOTLIGHT_PADDING * 2,
    }
    : undefined;
  const progress = Math.round(((safeStepIndex + 1) / steps.length) * 100);

  return (
    <div
      className="product-tour"
      role="dialog"
      aria-modal="true"
      aria-label={t('onboarding.tour.aria')}
      data-no-swipe="true"
      onWheel={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
      onTouchMove={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
    >
      <div className="product-tour__veil" aria-hidden="true" />
      {targetRect ? <div key={`spotlight-${step.id}`} className="product-tour__spotlight" aria-hidden="true" style={spotlightStyle} /> : null}

      <section
        key={step.id}
        ref={cardRef}
        className="product-tour__card"
        style={getCardStyle(targetRect, cardHeight)}
      >
        <div className="product-tour__progress">
          <span>{t('onboarding.tour.step', { current: safeStepIndex + 1, total: steps.length })}</span>
          <div className="product-tour__dots" aria-hidden="true">
            {steps.map((item, index) => (
              <span key={item.id} className={index === safeStepIndex ? 'is-active' : ''} />
            ))}
          </div>
        </div>
        <div className="product-tour__progress-bar" aria-hidden="true">
          <span style={{ width: `${progress}%` }} />
        </div>

        <h3>{t(step.titleKey)}</h3>
        <p>{t(step.captionKey)}</p>

        <div className={`product-tour__actions ${!isFirstStep ? 'product-tour__actions--no-skip' : ''}`}>
          {isFirstStep ? (
            <button type="button" className="product-tour__link" onClick={close}>
              {t('onboarding.tour.skip')}
            </button>
          ) : <span aria-hidden="true" />}
          <div>
            {safeStepIndex > 0 ? (
              <button type="button" className="app-secondary-button app-secondary-button--compact" onClick={previous}>
                {t('onboarding.tour.back')}
              </button>
            ) : null}
            <button type="button" className="app-primary-button app-primary-button--compact product-tour__primary" onClick={next}>
              {t(isLastStep ? 'onboarding.tour.done' : 'onboarding.tour.next')}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
