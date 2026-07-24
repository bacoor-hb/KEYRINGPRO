import React, { useEffect, useMemo, useRef, useState } from 'react'
import { View, StyleSheet, Image } from 'react-native'
import FastImage from 'react-native-fast-image'
import { getLength } from 'common/function'
import images from 'assets/Image'
import SvgLoader from 'frontend/Components/Common/SvgLoader'
const styles = StyleSheet.create({
  overFlow: {
    overflow: 'hidden'
  }
})

export const ImageRender = (props) => {
  const {
    onError,
    style,
    uri,
    uriDefault,
    resizeModeDefault = 'contain',
    resizeMode = 'cover',
    isLoadMoreByApiGG = false,
    // Opt-in: strip crash-prone <filter> primitives from remote SVGs (New-Arch
    // react-native-svg native abort). Forwarded to SvgLoader; off by default.
    sanitizeFilters = false
    // widthSvg = width(8),
    // heightSvg = width(8)
  } = props

  // link test SVG
  // const uri = 'https://collective-magenta-toucan.myfilebase.com/ipfs/QmPxRv3hRbFDN4BPhn3L8XeiTkkro7ezZ3BowaJxBa7Y2J'
  const [isReadSVGByType, setIsReadSVGByType] = useState(false)
  const [uriByGoogle, setUriByGoogle] = useState(null)

  const containerStyle = props.containerStyle || style

  const isUriDefaultLink = uriDefault && (uriDefault.toString().includes('http') || uriDefault.toString().includes('https'))
  const isMounted = useRef(true) // Track component mount status
  const localIOSFile = useMemo(() => {
    return uri && uri.toString().includes('ph://')
  }, [uri])

  const isImageBase = useMemo(() => {
    const listTypeImageBase = [
      'png',
      'jpg',
      'jpeg',
      'gif',
      'bmp',
      'webp',
      'tiff',
      'heic',
      'heif',
      'raw', // ios
      'avif', // ios
      'jfif'// ios
    ]
    const regex = new RegExp(`\\.(${listTypeImageBase.join('|')})(\\?.*)?$`, 'i')
    return !localIOSFile && uri && regex.test(uri.toString())
  }, [uri, localIOSFile])

  const isUriLink = useMemo(() => {
    return uri && (uri.toString().includes('http') || uri.toString().includes('https') || uri.toString().includes('file://'))
  }, [uri])

  const isSvg = useMemo(() => {
    return isUriLink && (uri.toString().includes('.svg'))
  }, [uri, isUriLink])

  useEffect(() => {
    const controller = new AbortController()
    const signal = controller.signal
    isMounted.current = true

    const getLinkByApiGG = async () => {
      try {
        const parsedUrl = new URL(uri)
        const domain = parsedUrl.hostname
        if (domain) {
          const uriTemp = `https://www.google.com/s2/favicons?domain=${domain}&sz=64`
          const res = await fetch(uriTemp, {
            signal,
            headers: { 'User-Agent': 'Mozilla/5.0' }
          })

          if (res?.ok && isLoadMoreByApiGG && isMounted.current) {
            setUriByGoogle(uriTemp)
          }
        }
      } catch {
        // do nothing
      }
    }
    async function doFetch () {
      try {
        const res = await fetch(uri, {
          signal,
          headers: { 'User-Agent': 'Mozilla/5.0' }
        })
        const contentType = res.headers.get('content-type')

        // Request image when file is text/html: Security Policy (CloudFlare)
        if (contentType?.includes('text/html')) {
          getLinkByApiGG()
        }

        if (contentType?.includes('image/svg') && isMounted.current) {
          setIsReadSVGByType(true)
        }
      } catch (error) {
        getLinkByApiGG()
      }
    }

    !localIOSFile && !isSvg && uri && !isImageBase && isUriLink && doFetch()
    return () => {
      isMounted.current = false
      controller.abort()
    }
  }, [uri, localIOSFile, isSvg, isImageBase, isUriLink, isLoadMoreByApiGG])

  const renderDefaultImage = () => {
    return (
      <FastImage
        onError={onError}
        style={style}
        source={
          isUriDefaultLink ? {
            isUriDefaultLink,
            priority: FastImage.priority.high
          } : uriDefault || images.keyringLogo2
        }
        resizeMode={FastImage.resizeMode[resizeModeDefault]}
      />
    )
  }

  try {
    if (isSvg || isReadSVGByType) {
      return (
        <View style={[styles.overFlow, containerStyle]}>
          <SvgLoader
            width={style.width}
            height={style.height}
            uri={uri}
            style={style}
            sanitizeFilters={sanitizeFilters}
            defaultImage={renderDefaultImage}
          />

        </View>
      )
    } else if (localIOSFile && ISIOS) {
      return (
        <View style={[styles.overFlow, containerStyle]}>
          <Image source={{ uri: uriByGoogle || uri }} resizeMode={resizeMode} style={style} />
        </View>
      )
    } else if (uri && getLength(uri.toString()) > 0) {
      return (
        <View style={[styles.overFlow, containerStyle]}>
          <FastImage
            onError={onError}
            style={[style]}
            source={
              isUriLink ? {
                uri: uriByGoogle || uri,
                priority: FastImage.priority.high,
                headers: {
                  'User-Agent': 'Mozilla/5.0'
                }
              } : uri
            }
            resizeMode={FastImage.resizeMode[resizeMode]}
          />

        </View>
      )
    } else {
      return renderDefaultImage()
    }
  } catch (error) {
    return renderDefaultImage()
  }
}
