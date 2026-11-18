import { describe, expect, it, vi } from 'vitest'

const apiStories = [
  {
    id: 1,
    title: 'Cuento de prueba',
    description: 'Un cuento para probar la caché.',
    cover: 'https://example.com/cover.jpg',
    content: 'Había una vez un elefante. El elefante era feliz.',
  },
]

function stubBrowserEnvironment(fetchImplementation: () => Promise<unknown>) {
  const storage = new Map<string, string>()

  vi.stubGlobal('sessionStorage', {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => {
      storage.set(key, value)
    },
  })
  vi.stubGlobal('window', { location: { origin: 'https://app.test' } })
  vi.stubGlobal('fetch', vi.fn(fetchImplementation))
}

async function loadStoryService(fetchImplementation: () => Promise<unknown>) {
  vi.stubEnv('VITE_API_BASE_URL', 'https://api.test')
  vi.resetModules()
  stubBrowserEnvironment(fetchImplementation)

  return import('./storyService')
}

function okResponse(body: unknown) {
  return Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve(body),
  })
}

describe('storyService cache', () => {
  it('no vuelve a pedir la lista mientras la caché está vigente', async () => {
    const fetchMock = vi.fn(() => okResponse(apiStories))
    const { getStories } = await loadStoryService(fetchMock)

    const first = await getStories()
    const second = await getStories()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(second).toEqual(first)
  })

  it('fuerza una recarga cuando se pide explícitamente', async () => {
    const fetchMock = vi.fn(() => okResponse(apiStories))
    const { getStories } = await loadStoryService(fetchMock)

    await getStories()
    await getStories({ force: true })

    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('expone la lista cacheada para pintar sin esperar a la red', async () => {
    const fetchMock = vi.fn(() => okResponse(apiStories))
    const { getCachedStories, getStories } = await loadStoryService(fetchMock)

    expect(getCachedStories()).toBeNull()

    await getStories()

    expect(getCachedStories()?.[0]?.title).toBe('Cuento de prueba')
  })
})
