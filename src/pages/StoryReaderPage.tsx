import { useEffect, useState } from 'react'
import type { Story } from '../types/story'
import { StoryCover } from '../components/stories/StoryCover'

interface StoryReaderPageProps {
  story: Story
  onBack: () => void
}

function createStoryPages(content: string): string[] {
  const sentences = content.trim().match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? []
  const pages: string[] = []

  for (let index = 0; index < sentences.length; index += 2) {
    pages.push(sentences.slice(index, index + 2).join(' ').trim())
  }

  return pages
}

function preloadCover(src: string): Promise<void> {
  if (!src) {
    return Promise.resolve()
  }

  return new Promise((resolve) => {
    const image = new Image()
    const timeoutId = window.setTimeout(finish, 15000)

    function finish() {
      window.clearTimeout(timeoutId)
      image.onload = null
      image.onerror = null
      resolve()
    }

    image.onload = finish
    image.onerror = finish
    image.src = src

    if (image.complete) {
      finish()
    }
  })
}

export function StoryReaderPage({ story, onBack }: StoryReaderPageProps) {
  const [hasStarted, setHasStarted] = useState(false)
  const [pageIndex, setPageIndex] = useState(0)
  const [loadedStoryId, setLoadedStoryId] = useState<number | null>(null)
  const pages = createStoryPages(story.content)
  const isPreparing = loadedStoryId !== story.id
  const isFinished = pageIndex >= pages.length
  const isIntro = isPreparing || !hasStarted
  const currentPage = pages[pageIndex]
  const progress = pages.length === 0 ? 0 : Math.round(((pageIndex + 1) / pages.length) * 100)

  useEffect(() => {
    let isCurrent = true

    async function prepareStory() {
      await preloadCover(story.cover)

      if (isCurrent) {
        setHasStarted(false)
        setPageIndex(0)
        setLoadedStoryId(story.id)
      }
    }

    void prepareStory()

    return () => {
      isCurrent = false
    }
  }, [story.content, story.cover, story.id])

  return (
    <section
      className={`page reader-page${isIntro ? ' reader-page--intro' : ' reader-page--reading'}`}
    >
      {isIntro ? (
        <>
          <StoryCover
            className="reader-intro__backdrop"
            src={story.cover}
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
        <span className="reader-header__wordmark">Cuentópolis</span>
        <span className="reader-header__spacer" aria-hidden="true" />
      </header>
      {!isIntro ? (
        <div className="reader-subheader">
          <h1>{story.title}</h1>
        </div>
      ) : null}

      {isPreparing ? (
        <div className="reader-loading" role="status" aria-live="polite">
          <span className="reader-loading__spinner" aria-hidden="true" />
          <p>Descargando cuento...</p>
        </div>
      ) : !hasStarted ? (
        <article className="reader-intro">
          <div className="reader-intro__details">
            <h1>{story.title}</h1>
            <p>{story.description}</p>
            <button
              className="primary-button reader-intro__button"
              type="button"
              onClick={() => setHasStarted(true)}
              disabled={pages.length === 0}
            >
              Comenzar a leer <span aria-hidden="true">→</span>
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
                <p className="story-text">{currentPage}</p>
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