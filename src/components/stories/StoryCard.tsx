import type { Story } from '../../types/story'
import { StoryCover } from './StoryCover'

interface StoryCardProps {
  story: Story
  onSelect: (storyId: number) => void
}

export function StoryCard({ story, onSelect }: StoryCardProps) {
  return (
    <article className="story-card">
      <button
        className="story-card__button"
        type="button"
        onClick={() => onSelect(story.id)}
      >
        <StoryCover
          className="story-card__cover"
          src={story.cover}
          title={story.title}
        />
        <span className="story-card__content">
          <span className="story-card__eyebrow">Un cuento para compartir</span>
          <span className="story-card__title">{story.title}</span>
          <span className="story-card__description">{story.description}</span>
          <span className="story-card__action" aria-hidden="true">
            Abrir cuento <span>↗</span>
          </span>
        </span>
      </button>
    </article>
  )
}