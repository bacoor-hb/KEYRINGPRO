import { getSizeImgSquare, pixelByHeight, pixelByWidth } from 'common/styles'

// Button SIZE (height / minWidth / radius / padding) — NOT color. Color lives in
// GlassView (variant tables). Size is owned by the caller (the button, or a
// view that wants button-like dimensions), so it stays a plain shared helper.

/**
 * @param {object} opts
 * @param {'small' | 'medium' | 'floating'} opts.size
 * @param {boolean} opts.noMinWidth
 * @param {boolean} opts.isUseHeader
 * @param {boolean} opts.isCircleBtn
 */
export const getSizeStyle = ({
  size = 'small',
  noMinWidth = false,
  isUseHeader = false,
  isCircleBtn = false
} = {}) => {
  const styleBase = {
    paddingHorizontal: pixelByWidth(12),
    borderRadius: 24
  }

  switch (size) {
    case 'small':
      styleBase.height = pixelByHeight(44)
      break
    case 'medium':
      styleBase.height = pixelByHeight(44)
      break
    case 'floating':
      styleBase.height = 52
      break
    default:
      styleBase.height = 44
      break
  }

  if (!noMinWidth) {
    styleBase.minWidth = 100
  }

  if (isUseHeader) {
    styleBase.height = getSizeImgSquare('large', 44)
  }
  if (isCircleBtn) {
    styleBase.borderRadius = 100
    styleBase.width = styleBase.height
    styleBase.minWidth = styleBase.height
  }

  return styleBase
}
