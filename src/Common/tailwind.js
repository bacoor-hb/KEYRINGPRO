import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn (...inputs) {
  return twMerge(clsx(inputs))
}

export function mergeStyle (...style) {
  return Array.isArray(style) ? [...style] : [{ ...style }]
}
