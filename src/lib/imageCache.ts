const cache = new Map<string, string>()
const MAX = 60

export const cached = (k: string) => cache.get(k)
export function remember(k: string, url: string) {
  cache.set(k, url)
  if (cache.size > MAX) {
    const first = cache.keys().next().value as string
    URL.revokeObjectURL(cache.get(first)!)
    cache.delete(first)
  }
}
