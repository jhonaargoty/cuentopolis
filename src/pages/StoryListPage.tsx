import { useEffect, useState } from 'react'
import type { Story } from '../types/story'
import { StoryList } from '../components/stories/StoryList'
import { StoryCover } from '../components/stories/StoryCover'
import { getStories } from '../services/storyService'

interface StoryListPageProps {
  onSelectStory: (story: Story) => void
}

export function StoryListPage({ onSelectStory }: StoryListPageProps) {
  const [stories, setStories] = useState<Story[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)
  const [loadAttempt, setLoadAttempt] = useState(0)

  useEffect(() => {
    let isCurrent = true

    async function loadStories() {
      setIsLoading(true)
      setHasError(false)

      try {
        const loadedStories = await getStories()
        if (isCurrent) {
          setStories(loadedStories)
        }
      } catch {
        if (isCurrent) {
          setHasError(true)
        }
      } finally {
        if (isCurrent) {
          setIsLoading(false)
        }
      }
    }

    void loadStories()
    return () => {
      isCurrent = false
    }
  }, [loadAttempt])

  const featuredStory = stories[0]
  const remainingStories = stories.slice(1)

  return (
    <section className="page story-list-page" id="biblioteca">
      <header className="library-header">
        <a className="wordmark" href="#biblioteca" aria-label="Cuentópolis, biblioteca">
          <span className="wordmark__spark" aria-hidden="true">✳</span>
          <span>Cuentópolis</span>
        </a>
        <span className="library-header__label">Biblioteca</span>
      </header>

      {isLoading ? (
        <div className="library-state" role="status">
          <span className="library-state__mark" aria-hidden="true">✦</span>
          <p>Abriendo el libro de cuentos...</p>
        </div>
      ) : hasError ? (
        <div className="library-state library-state--error" role="alert">
          <span className="library-state__mark" aria-hidden="true">↻</span>
          <p>No pudimos conectar con la biblioteca.</p>
          <button
            className="quiet-button"
            type="button"
            onClick={() => setLoadAttempt((attempt) => attempt + 1)}
          >
            Intentar de nuevo
          </button>
        </div>
      ) : stories.length === 0 ? (
        <div className="library-state">
          <span className="library-state__mark" aria-hidden="true">✧</span>
          <p>La biblioteca está esperando su próximo cuento.</p>
        </div>
      ) : (
        <>
          <section className="welcome-block" aria-labelledby="welcome-title">
            <p className="eyebrow">Un lugar para imaginar</p>
            <h1 id="welcome-title">Hola, pequeño lector.</h1>
            <p className="welcome-block__copy">
              Hay mundos nuevos entre estas páginas.
            </p>
          </section>

          {featuredStory ? (
            <section className="featured-story" aria-labelledby="featured-title">
              <div className="featured-story__copy">
                <p className="featured-story__eyebrow">Para empezar la aventura</p>
                <h2 id="featured-title">{featuredStory.title}</h2>
                <p>{featuredStory.description}</p>
                <button
                  className="primary-button featured-story__button"
                  type="button"
                  onClick={() => onSelectStory(featuredStory)}
                >
                  Leer este cuento <span aria-hidden="true">→</span>
                </button>
              </div>
              <StoryCover
                className="featured-story__cover"
                src={featuredStory.cover}
                title={featuredStory.title}
              />
              <span className="featured-story__stamp" aria-hidden="true">✦</span>
            </section>
          ) : null}

          {remainingStories.length > 0 ? (
            <section className="collection" aria-labelledby="collection-title">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Sigue explorando</p>
                  <h2 id="collection-title">Otros cuentos</h2>
                </div>
                <span className="section-heading__count">
                  {remainingStories.length} {remainingStories.length === 1 ? 'cuento' : 'cuentos'}
                </span>
              </div>
              <StoryList
                stories={remainingStories}
                onSelectStory={onSelectStory}
              />
            </section>
          ) : null}
        </>
      )}

      <footer className="library-footer">
        <span className="library-footer__spark" aria-hidden="true">✳</span>
        <p>Un cuento compartido se queda contigo.</p>
      </footer>
    </section>
  )
}