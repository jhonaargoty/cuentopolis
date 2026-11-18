import { useEffect, useMemo, useState } from 'react'
import type { Story } from '../types/story'
import { StoryCover } from '../components/stories/StoryCover'
import { StoryVoiceReader } from '../components/stories/StoryVoiceReader'
import { BrandMark } from '../components/BrandMark'
import { createStoryPages, getStoryAudioUrls } from '../services/storyPages'
import { preloadAudioBuffers } from '../services/audioPlayback'
import { useStoryPreparation } from '../hooks/useStoryPreparation'

interface StoryReaderPageProps {
  story: Story
  onBack: () => void
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function StoryReaderPage({ story, onBack }: StoryReaderPageProps) {
  const [startRequested, setStartRequested] = useState(false)
  const [pageIndex, setPageIndex] = useState(0)
  const preparation = useStoryPreparation(story)
  const pages = useMemo(() => createStoryPages(story), [story])
  const failedUrls = useMemo(
    () => new Set(preparation.failedUrls),
    [preparation.failedUrls],
  )
  const isFinished = pageIndex >= pages.length
  const hasStarted = startRequested && preparation.status === 'ready'
  const isIntro = !hasStarted
  const currentPage = pages[pageIndex]
  const currentPageSounds = (currentPage?.resources ?? []).filter(
    (sound) => !failedUrls.has(sound.audioUrl),
  )
  const progress =
    pages.length === 0 ? 0 : Math.round(((pageIndex + 1) / pages.length) * 100)
  const preparationProgress =
    preparation.progress.total === 0
      ? 100
      : Math.round(
          (preparation.progress.completed / preparation.progress.total) * 100,
        )
  const canStart =
    pages.length > 0 &&
    preparation.status !== 'preparing' &&
    preparation.status !== 'error'
  const isPreparing = preparation.status === 'preparing'
  const pageAudioUrls = useMemo(
    () => getStoryAudioUrls(story, pages),
    [pages, story],
  )

  useEffect(() => {
    if (preparation.status !== 'ready') {
      return
    }

    void preloadAudioBuffers(pageAudioUrls)
  }, [pageAudioUrls, preparation.status])

  function handleStart() {
    if (!canStart) {
      return
    }

    setStartRequested(true)

    if (preparation.status !== 'ready') {
      preparation.start()
    }
  }

  return (
    <section
      className={`page reader-page${isIntro ? ' reader-page--intro' : ' reader-page--reading'}`}
    >
      {isIntro ? (
        <>
          <StoryCover
            className="reader-intro__backdrop"
            src={preparation.coverUrl ?? story.cover}
            title={story.title}
          />
          <div className="reader-intro__shade" aria-hidden="true" />
        </>
      ) : null}

      <header className="reader-header">
        <button
          className="back-button"
          type="button"
          onClick={onBack}
          aria-label="Volver a la biblioteca"
        >
          <span aria-hidden="true">←</span>
        </button>
        <span className="reader-header__wordmark">
          <BrandMark className="reader-header__mark" />
          Cuentópolis
        </span>
        <span className="reader-header__spacer" aria-hidden="true" />
      </header>
      {!isIntro ? (
        <div className="reader-subheader">
          <h1>{story.title}</h1>
        </div>
      ) : null}

      {!hasStarted ? (
        <article className="reader-intro">
          <div className="reader-intro__details">
            <h1>{story.title}</h1>
            <p>{story.description}</p>

            {preparation.status === 'preparing' ? (
              <div className="reader-preparation" role="status" aria-live="polite">
                <p>
                  Preparando sonidos… {preparation.progress.completed} de{' '}
                  {preparation.progress.total}
                  {preparation.progress.loadedBytes > 0
                    ? ` · ${formatBytes(preparation.progress.loadedBytes)}`
                    : ''}
                </p>
                <div
                  className="reader-preparation__bar"
                  role="progressbar"
                  aria-label="Preparación del cuento"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={preparationProgress}
                >
                  <span style={{ width: `${preparationProgress}%` }} />
                </div>
              </div>
            ) : null}

            {preparation.status === 'error' ? (
              <div className="reader-preparation reader-preparation--warning" role="alert">
                <p>
                  No pudimos descargar los sonidos del cuento. Revisa tu conexión e
                  inténtalo de nuevo.
                </p>
                <button
                  className="quiet-button"
                  type="button"
                  onClick={preparation.retry}
                >
                  Reintentar
                </button>
              </div>
            ) : null}

            <button
              className="primary-button reader-intro__button"
              type="button"
              onClick={handleStart}
              disabled={!canStart}
            >
              {isPreparing ? 'Preparando sonidos…' : 'Comenzar a leer'}{' '}
              <span aria-hidden="true">→</span>
            </button>
          </div>
        </article>
      ) : (
        <article className="reader-content reader-content--reading">
          {isFinished ? (
            <div className="story-finished">
              <span className="story-finished__spark" aria-hidden="true">✦</span>
              <p className="eyebrow">Y colorín, colorado...</p>
              <h1>Final del cuento</h1>
              <p>Gracias por compartir esta historia.</p>
              <button className="primary-button" type="button" onClick={onBack}>
                Volver a la biblioteca
              </button>
            </div>
          ) : currentPage ? (
            <>
              <div className="story-paper" aria-live="polite" aria-atomic="true">
                <span className="story-paper__ornament" aria-hidden="true">❧</span>
                <p className="story-text">{currentPage.text}</p>
                <span className="story-paper__page-number" aria-hidden="true">
                  {pageIndex + 1}
                </span>
              </div>
              <div
                className="reading-progress"
                role="progressbar"
                aria-label="Progreso del cuento"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={progress}
              >
                <span style={{ width: `${progress}%` }} />
              </div>
              <nav className="reader-navigation" aria-label="Navegación del cuento">
                <button
                  className="secondary-button"
                  type="button"
                  disabled={pageIndex === 0}
                  onClick={() => setPageIndex((currentIndex) => currentIndex - 1)}
                >
                  Anterior
                </button>
                <button
                  className="primary-button"
                  type="button"
                  onClick={() => setPageIndex((currentIndex) => currentIndex + 1)}
                >
                  Siguiente
                </button>
              </nav>
              <StoryVoiceReader sounds={currentPageSounds} />
            </>
          ) : (
            <div className="story-finished">
              <p>Este cuento todavía no tiene texto para leer.</p>
              <button className="primary-button" type="button" onClick={onBack}>
                Volver a la biblioteca
              </button>
            </div>
          )}
        </article>
      )}
    </section>
  )
}
