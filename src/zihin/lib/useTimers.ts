import { useCallback, useEffect, useRef } from 'react'

// Bilesen kapaninca askida kalan zamanlayicilar temizlensin diye kucuk yardimci.
export function useTimers() {
  const ids = useRef<number[]>([])
  useEffect(() => {
    const list = ids.current
    return () => {
      list.forEach((id) => window.clearTimeout(id))
      list.length = 0
    }
  }, [])
  const later = useCallback((fn: () => void, ms: number) => {
    const id = window.setTimeout(() => {
      ids.current = ids.current.filter((x) => x !== id)
      fn()
    }, ms)
    ids.current.push(id)
    return id
  }, [])
  const clearAll = useCallback(() => {
    ids.current.forEach((id) => window.clearTimeout(id))
    ids.current = []
  }, [])
  return { later, clearAll }
}
