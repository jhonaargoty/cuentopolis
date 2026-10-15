import { useState } from 'react'
import { StoryListPage } from './pages/StoryListPage'
import { StoryReaderPage } from './pages/StoryReaderPage'
import type { Story } from './types/story'

function App() {
  const [selectedStory, setSelectedStory] = useState<Story | null>(null)

  return (
    <main className="app-shell">
      {selectedStory ? (
        <StoryReaderPage
          story={selectedStory}
          onBack={() => setSelectedStory(null)}
        />
      ) : (
        <StoryListPage
          onSelectStory={(story) => setSelectedStory(story)}
        />
      )}
    </main>
  )
}

export default App
