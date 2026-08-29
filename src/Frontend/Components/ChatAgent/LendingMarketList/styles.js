import { StyleSheet } from 'react-native'
import { pixelByWidth, pixelByHeight, Colors, sizeImageSquare } from 'common/styles'

// Width reserved for the "1." column. Fixed so every market name starts on the
// same x — including at rank 10, where the number is one character wider.
const RANK_WIDTH = pixelByWidth(22)

// How far the bullet lines sit in from the card's left edge: past the rank
// column, so they hang under the NAME rather than under the number, which is
// what makes the block read as one list item.
const BULLET_INDENT = RANK_WIDTH + pixelByWidth(6)

const styles = StyleSheet.create({
  container: {
    alignSelf: 'stretch',
    marginTop: pixelByHeight(6)
  },
  // No frame and no fill: this reads as a numbered list, not as a stack of
  // boxes. The rank and the bullet carry the structure; a card border around
  // each row would fight them and make five markets look like five separate
  // answers rather than one ranked list.
  // Wider than the 8px gap inside a row, so the eye groups each market with ITS
  // two buttons instead of pairing a market's buttons with the next market's
  // name. With two buttons per row that separation has to carry more work than
  // it did with one.
  card: {
    marginBottom: pixelByHeight(20)
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start'
  },
  rank: {
    width: RANK_WIDTH,
    color: Colors.WHITE
  },
  // flexShrink so a long vault name ("Gauntlet USDC Frontier") ellipsises inside
  // the row instead of pushing past the edge.
  nameWrap: {
    flex: 1,
    flexShrink: 1
  },
  // Brand blue, NO underline — the name is tappable (it opens the market's page
  // on the protocol) but the design calls for plain coloured text. Colour alone
  // carries the affordance here, consistent with the rest of the chat.
  name: {
    color: Colors.BRAND,
    textDecorationLine: 'underline'
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingLeft: BULLET_INDENT,
    marginTop: pixelByHeight(4)
  },
  bulletDot: {
    color: Colors.WHITE,
    marginRight: pixelByWidth(6)
  },
  bulletText: {
    flex: 1,
    flexShrink: 1,
    color: Colors.WHITE
  },
  // Full-width, so the tap target spans the row and the button reads as
  // belonging to the market above it rather than floating beside it.
  // Both buttons use this, so the gap between them is the same as the gap from
  // the APY line above. Kept tighter than `card.marginBottom` (14) on purpose:
  // the pair must read as belonging to the market above them rather than
  // floating midway between two markets.
  buttonWrap: {
    marginTop: pixelByHeight(8)
  },
  // Same pill as the message-level action buttons (see ChatAgent/styles.js): it
  // does the same thing — submits a prompt as the next turn — so it should not
  // look like a different kind of control. Border and fill come from GlassView;
  // adding one here would double up with its hairline.
  button: {
    minHeight: sizeImageSquare(44),
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: pixelByWidth(15),
    paddingVertical: pixelByHeight(10)
  },
  buttonText: {
    textAlign: 'center',
    color: Colors.WHITE
  }
})

export default styles
