import type { Story, StoryPage, PageResource } from '../types/story'
import { getPageSounds } from '../data/storySounds'

export function splitStorySentences(content: string): string[] {
  return content.trim().match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? []
}

export function createStoryPageTexts(content: string): string[] {
  const sentences = splitStorySentences(content)
  const pages: string[] = []

  for (let index = 0; index < sentences.length; index += 2) {
    pages.push(
      sentences
        .slice(index, index + 2)
        .map((sentence) => sentence.trim())
        .join(' ')
        .trim(),
    )
  }

  return pages
}

function dedupeResources(resources: PageResource[]): PageResource[] {
  const seen = new Set<string>()

  return resources.filter((resource) => {
    const key = `${resource.word}\u0000${resource.audioUrl}`
    if (seen.has(key)) {
      return false
    }

    seen.add(key)
    return true
  })
}

export function createStoryPages(story: Story): StoryPage[] {
  const pageTexts = createStoryPageTexts(story.content)
  const resourcesByPage = new Map<number, PageResource[]>()

  for (const resource of story.resources) {
    if (resource.page < 0 || resource.page >= pageTexts.length) {
      continue
    }

    const pageResources = resourcesByPage.get(resource.page) ?? []
    pageResources.push({
      word: resource.word,
      audioUrl: resource.audioUrl,
    })
    resourcesByPage.set(resource.page, pageResources)
  }

  return pageTexts.map((text, pageIndex) => {
    const storedResources = resourcesByPage.get(pageIndex)
    const resources =
      storedResources && storedResources.length > 0
        ? storedResources
        : getPageSounds(story.audioTriggers, text)

    return {
      text,
      resources: dedupeResources(resources),
    }
  })
}

export function getStoryAudioUrls(story: Story, pages: StoryPage[]): string[] {
  const urls = new Set<string>()

  for (const page of pages) {
    for (const resource of page.resources) {
      urls.add(resource.audioUrl)
    }
  }

  for (const trigger of story.audioTriggers) {
    if (trigger.enabled) {
      urls.add(trigger.audioUrl)
    }
  }

  return [...urls]
}
