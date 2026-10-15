const configuredApiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim()

export function getApiBaseUrl(): string {
  const apiBaseUrl = configuredApiBaseUrl?.replace(/\/+$/, '')

  if (!apiBaseUrl) {
    throw new Error('VITE_API_BASE_URL no está configurada.')
  }

  return apiBaseUrl
}