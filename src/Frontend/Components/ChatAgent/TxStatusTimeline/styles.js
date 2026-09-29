import { StyleSheet } from 'react-native'
import { width, height, pixelByHeight, pixelByWidth, getSizeImgSquare } from 'common/styles'

const COPY_SIZE = getSizeImgSquare('large')
const ICON_SIZE = getSizeImgSquare('large') // MyIcon variant='large' renders at 40

// Layout only — colors live in Tailwind className, text sizing in MyText variants.
const styles = StyleSheet.create({
  // ─── status timeline (compact; icon column + connector + body) ──────────────
  // No `gap`: the spacing between nodes is the connector's own `marginVertical`,
  // which already holds the line clear of the markers at both ends. A gap here
  // stacked on top of that, pushing every node apart twice over.
  statusWrap: { marginTop: height(1.5) },
  // Icon + title on one line, for a node that has no trail below it (the
  // "waiting for confirmation" step: no approx-time line, no hash).
  stepRowCenter: { flexDirection: 'row', alignItems: 'center' },
  // Success/Fail result row (StatusMessage) — vertically center the animation
  // against the title, matching the RegisterAddress / SendToken result rows.
  statusResult: { alignItems: 'center' },
  // Icon column (matches MyIcon variant='large'). Shared by both rows of a node,
  // so the icon and the connector below it sit on the same vertical.
  stepLeft: { width: ICON_SIZE, alignItems: 'center', marginRight: pixelByWidth(12), gap: pixelByHeight(6) },
  stepBodyLast: { flex: 1 },

  // ─── step node: head row + trail row ───────────────────────────────────────
  //
  // A node is TWO stacked containers, not one row with a tall right-hand body:
  //
  //   [ icon ]  Sending / Approximate time…      ← head
  //   [ line ]  0xabc… + copy, protocol link     ← trail
  //
  // Same icon column width, same gutter, same connector, same text as the
  // single-row form it replaces — what changes is the grouping. In one row the
  // icon sat beside the WHOLE body (title + time + hash), so `alignItems` could
  // only ever align the marker against the full stack; the icon therefore
  // floated against a block whose height swung with the hash, and a wrapped hash
  // dragged the title away from its own marker.
  //
  // Split, each row aligns on its own terms: the head centres the marker on the
  // title block it actually labels, and the trail owns the hash with the
  // connector running down its left. Anything that grows the hash block now
  // grows only the trail, leaving the head's alignment untouched.
  //
  // Lives here, in the stylesheet all three chat timelines share, so the shared
  // one and the multi-step Supply / Swap copies cannot drift apart.
  stepHeadRow: { flexDirection: 'row', alignItems: 'center' },
  // The trail's own breathing room, top and bottom, so the hash block is not
  // flush against the title above it or the next node below.
  stepTrailRow: { flexDirection: 'row', paddingVertical: pixelByHeight(4) },

  // The connector's column in the trail row. Same width and centring as
  // `stepLeft`, minus its vertical `gap` — the icon is not in this row.
  trailLeft: { alignItems: 'center' },

  // The connector itself. `flex: 1` stretches it down the full height of the
  // trail row, with `minHeight` as the floor for a node whose trail is short
  // (broadcast, no hash back yet).
  //
  // `marginVertical` is what keeps the line clear of the icons it runs between —
  // the step marker above it and the next node's marker below. `statusWrap`'s
  // `gap` only separates whole nodes; inside the icon column nothing else holds
  // the line off, so without this margin it runs flush into both markers.
  trailConnector: {
    width: pixelByWidth(2),
    flex: 1,
    marginVertical: pixelByHeight(8),
    minHeight: pixelByHeight(16),
    borderRadius: 1
  },

  // The hash / explorer-hint column of the trail row.
  //
  // The bottom padding balances the `marginTop: 8` that `hashRow` /
  // `explorerHint` bring with them, so the hash sits evenly between the line
  // above it and the next node below — without it the hash ends flush against
  // whatever follows. It lands on this column rather than the row so the
  // connector, which is `flex: 1` against it, runs the full height beside it.
  trailBody: { flex: 1, paddingBottom: pixelByHeight(8) },
  stepDesc: { marginTop: pixelByHeight(2) },
  // "Sending" title + inline loading dots while the broadcast hash is pending.
  titleRow: { flexDirection: 'row', alignItems: 'center' },
  // Only the gap from the title — size comes from MyDotsLoading's default variant.
  titleDots: { marginLeft: width(1) },
  // Explorer fallback shown under "Sending" until the tx hash arrives.
  explorerHint: { marginTop: pixelByHeight(8) },
  explorerLink: { marginTop: pixelByHeight(4) },

  ctaWrap: { marginTop: height(1) },

  hashRow: { flexDirection: 'row', alignItems: 'center', gap: pixelByWidth(12), marginTop: pixelByHeight(8) },
  hashTextWrap: { flex: 1 },
  copyBtn: { width: COPY_SIZE, height: COPY_SIZE, alignItems: 'center', justifyContent: 'center', borderRadius: COPY_SIZE }
})

export default styles
