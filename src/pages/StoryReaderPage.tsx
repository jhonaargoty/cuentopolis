import { useState } from 'react'
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

export function StoryReaderPage({ story, onBack }: StoryReaderPageProps) {
  const [pageIndex, setPageIndex] = useState(0)
  const pages = createStoryPages(story.content)
  const isFinished = pageIndex >= pages.length
  const currentPage = pages[pageIndex]
  const progress = pages.length === 0 ? 0 : Math.round(((pageIndex + 1) / pages.length) * 100)

  return (
    <section className="page reader-page">
      <header className="reader-header">
        <button className="back-button" type="button" onClick={onBack}>
          <span aria-hidden="true">←</span>
          <span>Biblioteca</span>
        </button>
        <span className="reader-header__wordmark">Cuentópolis</span>
        <span className="reader-header__ornament" aria-hidden="true">✳</span>
      </header>

      <article className="reader-content">
        <div className="reader-book">
          <StoryCover
            className="reader-book__cover"
            src={story.cover}
            title={story.title}
          />
          <div className="reader-book__details">
            <p className="eyebrow">Un cuento de Cuentópolis</p>
            <h1>{story.title}</h1>
            <p>{story.description}</p>
          </div>
        </div>
        {isFinished ? (
          <div className="story-finished">
            <span className="story-finished__spark" aria-hidden="true">✦</span>
            <p className="eyebrow">Y colorín, colorado...</p>
            <h2>Final del cuento</h2>
            <p>Gracias por compartir esta historia.</p>
            <button className="primary-button" type="button" onClick={onBack}>
              Volver a la biblioteca
            </button>
          </div>
        ) : currentPage ? (
          <>
            <div className="reading-progress">
              <div className="reading-progress__label">
                <span>Página {pageIndex + 1}</span>
                <span>{pages.length} páginas</span>
              </div>
              <div
                className="reading-progress__track"
                role="progressbar"
                aria-label="Progreso del cuento"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={progress}
              >
                <span style={{ width: `${progress}%` }} />
              </div>
            </div>
            <div className="story-paper" aria-live="polite" aria-atomic="true">
              <span className="story-paper__ornament" aria-hidden="true">❧</span>
              <p className="story-text">{currentPage}</p>
              <span className="story-paper__page-number" aria-hidden="true">
                {pageIndex + 1}
              </span>
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
    </section>
  )
}