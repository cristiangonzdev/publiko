'use client'

import { useState, useCallback } from 'react'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useFormState(initial: Record<string, any>) {
  const [state, setState] = useState(initial)

  const update = useCallback((key: string, value: unknown) => {
    setState((prev) => ({ ...prev, [key]: value }))
  }, [])

  return [state, update] as const
}
