import { useEffect, type PropsWithChildren } from 'react';

import { useSettingsStore } from '@/features/settings/model/settings.store';
import { hasRuntimeTranslation, translateRuntimeText } from '@/shared/lib/i18n';

const textNodeOriginals = new WeakMap<Text, string>();
const attrOriginals = new WeakMap<Element, Map<string, string>>();
const translatedAttributes = ['placeholder', 'aria-label', 'title'] as const;
const ignoredTags = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'SVG', 'PATH', 'TEXTAREA']);

function shouldSkipElement(element: Element) {
  if (ignoredTags.has(element.tagName)) return true;
  if (element.closest('[data-no-i18n="true"]')) return true;
  return false;
}

function translateTextNode(node: Text, language: 'ru' | 'en') {
  const parent = node.parentElement;
  if (!parent || shouldSkipElement(parent)) return;

  const current = node.nodeValue ?? '';
  if (!textNodeOriginals.has(node) && hasRuntimeTranslation(current)) {
    textNodeOriginals.set(node, current);
  }

  const original = textNodeOriginals.get(node);
  if (!original) return;

  const next = language === 'ru' ? original : translateRuntimeText(language, original);
  if (current !== next) node.nodeValue = next;
}

function getAttrOriginals(element: Element) {
  let map = attrOriginals.get(element);
  if (!map) {
    map = new Map<string, string>();
    attrOriginals.set(element, map);
  }
  return map;
}

function translateElementAttributes(element: Element, language: 'ru' | 'en') {
  if (shouldSkipElement(element)) return;

  const originals = getAttrOriginals(element);

  for (const attr of translatedAttributes) {
    const current = element.getAttribute(attr);
    if (!current) continue;

    if (!originals.has(attr) && hasRuntimeTranslation(current)) {
      originals.set(attr, current);
    }

    const original = originals.get(attr);
    if (!original) continue;

    const next = language === 'ru' ? original : translateRuntimeText(language, original);
    if (current !== next) element.setAttribute(attr, next);
  }
}

function translateTree(root: ParentNode, language: 'ru' | 'en') {
  if (root instanceof Element) translateElementAttributes(root, language);

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();

  while (node) {
    if (node.nodeType === Node.TEXT_NODE) {
      translateTextNode(node as Text, language);
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      translateElementAttributes(node as Element, language);
    }

    node = walker.nextNode();
  }
}

export function LanguageRuntimeProvider({ children }: PropsWithChildren) {
  const language = useSettingsStore((state) => state.appLanguage);

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dataset.appLanguage = language;

    let scheduled = false;
    let internalUpdate = false;

    const run = () => {
      scheduled = false;
      internalUpdate = true;
      translateTree(document.body, language);
      window.setTimeout(() => {
        internalUpdate = false;
      }, 0);
    };

    const schedule = () => {
      if (scheduled || internalUpdate) return;
      scheduled = true;
      window.requestAnimationFrame(run);
    };

    run();

    const observer = new MutationObserver((mutations) => {
      if (internalUpdate) return;
      for (const mutation of mutations) {
        if (mutation.type === 'childList' || mutation.type === 'characterData' || mutation.type === 'attributes') {
          schedule();
          break;
        }
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: [...translatedAttributes],
    });

    return () => observer.disconnect();
  }, [language]);

  return <>{children}</>;
}
