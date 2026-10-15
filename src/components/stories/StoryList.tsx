import type { Story } from '../../types/story'
import { StoryCard } from './StoryCard'

interface StoryListProps {
  stories: Story[]
  onSelectStory: (story: Story) => void
}

export function StoryList({ stories, onSelectStory }: StoryListProps) {
  return (
    <div className="story-list">
      {stories.map((story) => (
        <StoryCard
          key={story.id}
          story={story}
          onSelect={() => onSelectStory(story)}
        />
      ))}
    </div>
  )
}