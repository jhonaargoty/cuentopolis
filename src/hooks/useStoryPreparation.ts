import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Story } from '../types/story'
import {
  prepareStory,
  type StoryPreparationProgress,
} from '../services/storyResources'

export type PreparationStatus = 'preparing' | 'ready' | 'partial' | 'error'

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

export function useStoryPreparation(story: Story) {
  const [state, setState] = useState<StoryPreparationState>({
    status: 'preparing',
    progress: initialProgress,
    failedUrls: [],
    fromCache: false,
  })
  const [attempt, setAttempt] = useState(0)
  const [coverBlob, setCoverBlob] = useState<Blob | null>(null)
  const runIdRef = useRef(0)

  useEffect(() => {
    const runId = runIdRef.current + 1
    runIdRef.current = runId
    let isActive = true

    void prepareStory(story, {
      onProgress: (progress) => {
        if (!isActive || runIdRef.current !== runId) {
          return
        }

        setState((current) => ({
          ...current,
          progress,
        }))
      },
    })
      .then((result) => {
        if (!isActive || runIdRef.current !== runId) {
          return
        }

        setState({
          status: result.failedCount > 0 ? 'partial' : 'ready',
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
        if (!isActive || runIdRef.current !== runId) {
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
  }, [story, attempt])

  const retry = useCallback(() => {
    setState({
      status: 'preparing',
      progress: initialProgress,
      failedUrls: [],
      fromCache: false,
    })
    setCoverBlob(null)
    setAttempt((currentAttempt) => currentAttempt + 1)
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
    retry,
    isReady: state.status === 'ready' || state.status === 'partial',
  }
}
