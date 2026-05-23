import { useEffect, useState } from 'react'

/** Load a persisted config value and refresh when Settings saves it. */
export function useConfigKey(key) {
  const [value, setValue] = useState('')

  useEffect(() => {
    let active = true

    window.api.configGet(key).then((stored) => {
      if (!active) return
      setValue(typeof stored === 'string' ? stored : stored ? String(stored) : '')
    })

    const unsubscribe = window.api.onConfigUpdated?.(({ key: updatedKey, value: nextValue }) => {
      if (updatedKey !== key) return
      setValue(typeof nextValue === 'string' ? nextValue : nextValue ? String(nextValue) : '')
    })

    return () => {
      active = false
      unsubscribe?.()
    }
  }, [key])

  return value
}
