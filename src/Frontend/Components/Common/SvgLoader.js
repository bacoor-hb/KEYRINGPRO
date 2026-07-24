import React, { useMemo } from 'react'

import { SvgUri, SvgXml } from 'react-native-svg'
import { useQuery } from 'react-query'
const fetchSvg = async (uri) => {
  try {
    const response = await fetch(uri)
    if (!response.ok) {
      return { isError: true }
    }
    const svgText = await response.text()
    if (!svgText.includes('<svg')) {
      return { isError: true }
    }
    return { data: svgText, isError: false }
  } catch (error) {
    return { isError: true }
  }
}

// react-native-svg's native filter renderer aborts (SIGABRT) on the New
// Architecture for some remote SVGs that use <filter> primitives
// (feGaussianBlur/feColorMatrix/feComposite…). Filters are purely decorative
// (shadows/blurs), so for small icons we can drop them rather than risk the
// crash: remove the <filter> defs and any filter="url(#…)" references, then
// render the sanitized markup via SvgXml.
export const stripFilters = (xml) =>
  xml
    .replace(/<filter[\s\S]*?<\/filter>/gi, '')
    .replace(/<filter\b[^>]*\/>/gi, '')
    .replace(/\sfilter\s*=\s*("[^"]*"|'[^']*')/gi, '')

// `sanitizeFilters` is opt-in: SvgLoader is shared, so by default every caller
// keeps the untouched SvgUri path. Only callers that knowingly render
// filter-heavy remote SVGs (e.g. the Other Networks chain list) pass it.
const SvgLoader = ({ uri, defaultImage, sanitizeFilters = false, ...props }) => {
  const { data, isLoading } = useQuery(['SVG_LOADER', uri], () => fetchSvg(uri))

  const svgText = data?.data
  const hasFilter = typeof svgText === 'string' && svgText.includes('<filter')
  // Only switch to the (sanitized) SvgXml path when opted in AND filters are
  // present — every other SVG stays on the exact same SvgUri path.
  const safeXml = useMemo(
    () => (sanitizeFilters && hasFilter ? stripFilters(svgText) : null),
    [sanitizeFilters, hasFilter, svgText]
  )

  if (data?.isError || isLoading) {
    return defaultImage && defaultImage()
  }

  if (safeXml) {
    return <SvgXml xml={safeXml} {...props} />
  }

  return <SvgUri uri={uri} {...props} />
}

export default SvgLoader
