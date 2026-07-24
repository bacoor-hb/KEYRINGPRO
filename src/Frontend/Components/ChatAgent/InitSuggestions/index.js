import React from 'react'
import { View, TouchableOpacity } from 'react-native'
import MyText from 'frontend/Components/UI/MyText'
import GlassView from 'frontend/Components/UI/GlassView'
import styles from './styles'

export { AI_SUGGESTIONS, isLocal, hasChildren, getOptionsAt, getBranchReply, getUserText } from './suggestionTree'

// Stacked, colorless liquid-glass pills — the same visual language as the reply
// action buttons (see ChatAgent/MessageBubble).
//
// Purely presentational: it renders whatever level of the suggestion tree it is
// handed (see suggestionTree.js) and reports the tapped node upward, along with
// `path` — the level being rendered — so the caller can address the node's
// children without this component tracking any position itself. Deciding whether
// that node drills down locally or sends a turn to the agent belongs to the
// caller (useSuggestionTree + AISearch's page), not here.
const InitSuggestions = ({ options, path, onSelect }) => {
  if (!options?.length) return null
  return (
    <View style={styles.list}>
      {options.map((item) => (
        <TouchableOpacity
          key={item.key}
          activeOpacity={0.8}
          style={styles.btnWrap}
          onPress={() => onSelect(item, path)}
        >
          <GlassView interactive effect='clear' style={styles.btn}>
            <MyText style={styles.btnText}>{item.title()}</MyText>
          </GlassView>
        </TouchableOpacity>
      ))}
    </View>
  )
}

export default InitSuggestions
