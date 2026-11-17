export interface AudioTrigger {
  words: string[]
  audioUrl: string
  enabled: boolean
}

export interface PageResource {
  word: string
  audioUrl: string
}

export interface StoryResource extends PageResource {
  page: number
}

export interface StoryPage {
  text: string
  resources: PageResource[]
}

export interface Story {
  id: number
  title: string
  description: string
  cover: string
  content: string
  audioTriggers: AudioTrigger[]
  resources: StoryResource[]
}