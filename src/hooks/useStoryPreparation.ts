import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Story } from '../types/story'
import {
  prepareStory,
  type StoryPreparationProgress,
} from '../services/storyResources'

export type PreparationStatus = 'idle' | 'preparing' | 'ready' | 'error'

export interface StoryPreparationState {
  status: PreparationStatus
  progress: StoryPreparationProgress
  failedUrls: string[]
  fromCache: boolean
}

const initialProgress: StoryPreparationProgress = {
  completed: 0,
  total: 0,
  loadedBytes: 0,
  totalBytes: 0,
  failedCount: 0,
}

const initialPreparationState: StoryPreparationState = {
  status: 'idle',
  progress: initialProgress,
  failedUrls: [],
  fromCache: false,
}

export function useStoryPreparation(story: Story) {
  const [state, setState] = useState<StoryPreparationState>(
    initialPreparationState,
  )
  const [runId, setRunId] = useState(0)
  const [coverBlob, setCoverBlob] = useState<Blob | null>(null)
  const runIdRef = useRef(0)

  useEffect(() => {
    if (runId === 0) {
      return
    }

    const currentRunId = runIdRef.current + 1
    runIdRef.current = currentRunId
    let isActive = true

    void prepareStory(story, {
      onProgress: (progress) => {
        if (!isActive || runIdRef.current !== currentRunId) {
          return
        }

        setState((current) => ({
          ...current,
          progress,
        }))
      },
    })
      .then((result) => {
        if (!isActive || runIdRef.current !== currentRunId) {
          return
        }

        setState({
          status: result.failedAudioCount > 0 ? 'error' : 'ready',
          progress: {
            completed: result.completed,
            total: result.total,
            loadedBytes: result.loadedBytes,
            totalBytes: result.totalBytes,
            failedCount: result.failedCount,
          },
          failedUrls: result.failedUrls,
          fromCache: result.fromCache,
        })
        setCoverBlob(result.coverBlob)
      })
      .catch(() => {
        if (!isActive || runIdRef.current !== currentRunId) {
          return
        }

        setState((current) => ({
          ...current,
          status: 'error',
        }))
      })

    return () => {
      isActive = false
    }
  }, [story, runId])

  const start = useCallback(() => {
    setState({ ...initialPreparationState, status: 'preparing' })
    setCoverBlob(null)
    setRunId((currentRun) => currentRun + 1)
  }, [])

  const coverUrl = useMemo(
    () => (coverBlob ? URL.createObjectURL(coverBlob) : null),
    [coverBlob],
  )

  useEffect(
    () => () => {
      if (coverUrl) {
        URL.revokeObjectURL(coverUrl)
      }
    },
    [coverUrl],
  )

  return {
    ...state,
    coverUrl,
    start,
    retry: start,
    isReady: state.status === 'ready',
  }
}
