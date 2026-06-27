import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { getPresentationDeck, type PresentationSlide } from '../extensions/presentation';
import { PreviewPane } from './PreviewPane';
import { t } from '../../i18n';

interface PresentationOverlayProps {
  content: string;
  documentPath?: string;
  onClose: () => void;
  onNotice?: (message: string) => void;
  onOpenDocumentLink?: (
    target: string,
    options: { kind: 'markdown' | 'wiki'; sourcePath?: string },
  ) => void | Promise<void>;
}

function getBackgroundStyle(slide: PresentationSlide): CSSProperties {
  const background = slide.background?.trim();
  if (!background) return {};

  if (/^(?:#|rgb|hsl|color\(|linear-gradient|radial-gradient)/i.test(background)) {
    return { background };
  }

  return {
    backgroundImage: `url("${background.replace(/"/g, '\\"')}")`,
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
    backgroundSize: 'cover',
  };
}

function applyFragmentVisibility(root: HTMLElement | null, visibleCount: number) {
  if (!root) return 0;
  const fragments = Array.from(root.querySelectorAll<HTMLElement>('.fragment'));
  fragments.forEach((fragment, index) => {
    fragment.classList.toggle('visible', index < visibleCount);
  });
  return fragments.length;
}

export function PresentationOverlay({
  content,
  documentPath,
  onClose,
  onNotice,
  onOpenDocumentLink,
}: PresentationOverlayProps) {
  const deck = useMemo(() => getPresentationDeck(content), [content]);
  const { config, slides } = deck;
  const [slideIndex, setSlideIndex] = useState(0);
  const [visibleFragments, setVisibleFragments] = useState(0);
  const [fragmentCount, setFragmentCount] = useState(0);
  const slideRef = useRef<HTMLDivElement>(null);
  const currentSlide = slides[slideIndex] ?? slides[0];
  const showControls = config.controls !== false;
  const showProgress = config.progress !== false;
  const showSlideNumber = config.slideNumber !== false;

  useEffect(() => {
    setSlideIndex(0);
    setVisibleFragments(0);
  }, [content]);

  useEffect(() => {
    const root = slideRef.current;
    if (!root) return;

    const update = () => {
      setFragmentCount(applyFragmentVisibility(root, visibleFragments));
    };
    update();

    const observer = new MutationObserver(update);
    observer.observe(root, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [slideIndex, visibleFragments]);

  const goNext = useCallback(() => {
    if (visibleFragments < fragmentCount) {
      setVisibleFragments((value) => value + 1);
      return;
    }

    setSlideIndex((value) => {
      if (value >= slides.length - 1) return value;
      setVisibleFragments(0);
      return value + 1;
    });
  }, [fragmentCount, slides.length, visibleFragments]);

  const goPrevious = useCallback(() => {
    if (visibleFragments > 0) {
      setVisibleFragments((value) => Math.max(0, value - 1));
      return;
    }

    setSlideIndex((value) => {
      if (value <= 0) return value;
      setVisibleFragments(0);
      return value - 1;
    });
  }, [visibleFragments]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }

      if (['ArrowRight', 'PageDown', ' ', 'Enter'].includes(event.key)) {
        event.preventDefault();
        goNext();
        return;
      }

      if (['ArrowLeft', 'PageUp', 'Backspace'].includes(event.key)) {
        event.preventDefault();
        goPrevious();
      }
    };

    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [goNext, goPrevious, onClose]);

  if (!currentSlide) {
    return null;
  }

  return (
    <div className="prism-presentation" role="dialog" aria-modal="true" aria-label={t('presentation.title')}>
      {currentSlide.backgroundIframe && (
        <iframe
          className="prism-presentation__iframe"
          src={currentSlide.backgroundIframe}
          title={t('presentation.backgroundIframe')}
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        />
      )}
      <div className="prism-presentation__topbar">
        <span>{t('presentation.title')}</span>
        {showSlideNumber && (
          <span>{t('presentation.counter', { current: slideIndex + 1, total: slides.length })}</span>
        )}
        <button type="button" onClick={onClose}>{t('common.close')}</button>
      </div>
      {showProgress && (
        <div className="prism-presentation__progress" aria-hidden="true">
          <span style={{ width: `${((slideIndex + 1) / slides.length) * 100}%` }} />
        </div>
      )}
      <div
        ref={slideRef}
        className="prism-presentation__slide"
        data-transition={typeof config.transition === 'string' ? config.transition : undefined}
        data-transition-speed={typeof config.transitionSpeed === 'string' ? config.transitionSpeed : undefined}
        style={getBackgroundStyle(currentSlide)}
      >
        <PreviewPane
          content={currentSlide.markdown}
          documentPath={documentPath}
          renderStrategy="immediate"
          onNotice={onNotice}
          onOpenDocumentLink={onOpenDocumentLink}
        />
      </div>
      {showControls && (
        <div className="prism-presentation__controls" aria-label={t('presentation.controls')}>
          <button type="button" onClick={goPrevious} disabled={slideIndex === 0 && visibleFragments === 0}>
            {t('presentation.previous')}
          </button>
          <button
            type="button"
            onClick={goNext}
            disabled={slideIndex >= slides.length - 1 && visibleFragments >= fragmentCount}
          >
            {t('presentation.next')}
          </button>
        </div>
      )}
    </div>
  );
}
