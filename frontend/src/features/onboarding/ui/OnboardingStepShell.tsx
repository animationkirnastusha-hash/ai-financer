import type { PropsWithChildren } from 'react';

export function OnboardingStepShell({
  eyebrow,
  title,
  description,
  children,
}: PropsWithChildren<{ eyebrow: string; title: string; description?: string }>) {
  return (
    <section className="onboarding-step-shell">
      <div className="app-eyebrow">{eyebrow}</div>
      <h2>{title}</h2>
      {description ? <p>{description}</p> : null}
      <div className="onboarding-step-shell__body">{children}</div>
    </section>
  );
}

export function OnboardingChoice({
  active,
  title,
  caption,
  onClick,
}: {
  active?: boolean;
  title: string;
  caption?: string;
  onClick: () => void;
}) {
  return (
    <button type="button" className={`onboarding-choice ${active ? 'is-active' : ''}`} onClick={onClick}>
      <span>{title}</span>
      {caption ? <small>{caption}</small> : null}
    </button>
  );
}
