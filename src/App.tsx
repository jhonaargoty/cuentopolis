import { useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { StoryListPage } from './pages/StoryListPage'
import { StoryReaderPage } from './pages/StoryReaderPage'
import { UpdateBanner } from './components/UpdateBanner'
import { InstallGuide } from './components/InstallGuide'
import type { Story } from './types/story'

function App() {
  const [selectedStory, setSelectedStory] = useState<Story | null>(null)
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW()

  function handleUpdate() {
    setNeedRefresh(false)
    void updateServiceWorker(true)
  }

  return (
    <main className={`app-shell${selectedStory ? ' app-shell--reader' : ''}`}>
      {selectedStory ? (
        <StoryReaderPage
          key={selectedStory.id}
          story={selectedStory}
          onBack={() => setSelectedStory(null)}
        />
      ) : (
        <StoryListPage
          onSelectStory={(story) => setSelectedStory(story)}
        />
      )}

      {needRefresh ? (
        <UpdateBanner isReading={Boolean(selectedStory)} onUpdate={handleUpdate} />
      ) : null}

      {!selectedStory ? <InstallGuide /> : null}
    </main>
  )
}

export default App
