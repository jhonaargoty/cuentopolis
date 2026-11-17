export interface PerfMetric {
  name: string
  milliseconds: number
  at: number
}

const metrics: PerfMetric[] = []
const MAX_METRICS = 50

export function recordMetric(name: string, milliseconds: number): PerfMetric {
  const metric = {
    name,
    milliseconds: Math.round(milliseconds),
    at: Date.now(),
  }

  metrics.push(metric)
  if (metrics.length > MAX_METRICS) {
    metrics.shift()
  }

  return metric
}

export function getMetrics(): PerfMetric[] {
  return [...metrics]
}

export function isDebugEnabled(): boolean {
  if (import.meta.env.DEV) {
    return true
  }

  try {
    return window.localStorage.getItem('cuentopolis:debug') === '1'
  } catch {
    return false
  }
}
