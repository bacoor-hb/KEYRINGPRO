import React from 'react'
import { View, TouchableOpacity } from 'react-native'
import MyText from 'frontend/Components/UI/MyText'

/**
 * Renders a translated string that contains {{placeholder}} tokens as inline
 * clickable links. Link positions follow the translation order, so word order
 * across languages is respected automatically.
 *
 * @param {string} text  - Translated string, e.g. 'Agree to {{term}} and {{policy}}'
 * @param {Object} links - Map of placeholder key → { label: string, onPress: fn }
 * @param {string} [variant='small'] - MyText variant for all text segments
 * @param {string} [className] - Tailwind classes applied to plain-text segments
 * @param {string} [linkClassName='text-brand'] - Tailwind classes applied to link segments
 */
export default function I18nWithLinks ({ text, links, variant = 'default', className, linkClassName = 'text-brand' }) {
  const parts = text.split(/(\{[^}]+\})/)

  return (
    <View className='flex flex-row flex-wrap justify-center items-center'>
      {parts.map((part, index) => {
        const match = part.match(/^\{(.+)\}$/)
        if (match) {
          const link = links[match[1]]
          if (link) {
            return (
              <TouchableOpacity key={index} onPress={link.onPress} activeOpacity={1}>
                <MyText variant={variant} className={linkClassName}>{link.label}</MyText>
              </TouchableOpacity>
            )
          }
        }
        if (part.trim()) {
          return <MyText key={index} variant={variant} className={className}>{part}</MyText>
        }
        return null
      })}
    </View>
  )
}
