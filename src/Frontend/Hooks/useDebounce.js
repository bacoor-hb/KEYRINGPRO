import { debounce } from 'lodash'
import { useEffect, useRef } from 'react'

export const useDebounce = (func, delay = 1000) => {
  const debounceFunc = useRef(null)

  useEffect(() => {
    if (func) {
      // @ts-ignore
      debounceFunc.current = debounce(func, delay)
    }
  }, [])

  const debFunc = () => {
    if (debounceFunc.current) {
      return debounceFunc.current
    }
    return func
  }
  return debFunc()
}
