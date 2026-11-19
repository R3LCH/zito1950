import { useSyncExternalStore } from 'react'
import type { FilterGender } from './catalogFilters'

/** The one watch line the open catalogue is filtered to, or null; the header marks its pill as current. */
let line: FilterGender | null = null
const listeners = new Set<() => void>()

export function setCatalogLine(next: FilterGender | null) {
  if (next === line) return
  line = next
  for (const listener of listeners) listener()
}

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export const useCatalogLine = () => useSyncExternalStore(subscribe, () => line, () => null)
