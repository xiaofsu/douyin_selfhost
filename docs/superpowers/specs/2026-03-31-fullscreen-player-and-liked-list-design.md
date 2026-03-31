# Fullscreen Player And Liked List Design

Date: 2026-03-31

## Context

The current frontend still carries several feed-style UI layers that reduce fullscreen immersion:

- The player renders a separate header block and bottom navigation block instead of letting controls float directly on the video.
- The player shows extra copy such as large descriptive text and the long-press hint.
- The right-side action stack includes non-essential elements like the avatar.
- The liked list page still uses large titles and explanatory copy instead of a minimal content-first layout.
- Long-press playback can trigger browser-native text selection or callout behavior, which breaks the intended 2x gesture.

The user-approved target is a fullscreen browsing experience with minimal chrome, fixed top-right text navigation, and a liked list page that remains a list-first destination.

## Goals

- Make the player feel fullscreen and immersive, with UI floating directly over the video.
- Keep only the controls and metadata required for fast browsing.
- Replace block-style header/footer navigation with fixed top-right text navigation.
- Preserve the existing random home feed behavior and the existing liked-list-first information architecture.
- Fix long-press interaction so only the custom 2x playback feedback appears.

## Non-Goals

- No backend API changes beyond the already-finished paging and preload work.
- No change to the meaning of `首页`, `我的`, home random feed, or liked list data.
- No conversion of `我的` into a TikTok-style liked video stream.
- No redesign of business logic for likes, routing semantics, or data persistence.

## Approved Direction

Recommended approach: update both the fullscreen player and the liked list page to use a consistent minimal navigation language while keeping the existing liked-list-first interaction model.

Why this approach:

- It addresses the exact UI and UX issues the user called out.
- It preserves the existing route model, which reduces regression risk.
- It avoids unnecessary full-app visual churn.

## Player Layout

The player becomes a pure fullscreen stage:

- Video fills the viewport.
- All player chrome is rendered as overlays directly on top of the video.
- There is no separate header card or bottom navigation block.

### Top-Right Navigation

- Fixed text navigation appears at the top-right edge of the player.
- The navigation contains exactly two items: `首页` and `我的`.
- On the home random feed, `首页` is visually active.
- On a player entered from the liked section, `我的` is visually active.
- Clicking `首页` navigates to the home random feed.
- Clicking `我的` navigates to the liked list page.

### Left-Bottom Metadata

The lower-left metadata block is reduced to two lines only:

- File name
- Current directory

Removed from the player metadata area:

- Video description
- Author handle
- Extra captions
- Long-press instruction text

### Right-Side Actions

The right-side action area is reduced to a single like button:

- Keep one like icon button only.
- Remove avatar.
- Remove any Douyin/TikTok-style decorative action items.
- Keep the existing like state and pending state behavior.

### Bottom Progress And Time

- Keep a very thin progress line at the bottom edge of the player.
- Keep time text.
- Remove all other bottom helper text.

The progress indicator must stay visually light so the video remains dominant.

## Long-Press 2x Interaction

Long-press remains the mechanism for temporary 2x playback, but the visual and browser behavior changes:

- The player must not trigger browser-native text selection.
- The player must not trigger browser-native long-press callouts, context popups, or selection handles.
- During active long press, show only one custom status label: `2 倍速播放中`.
- That status label is horizontally centered and positioned higher than the current implementation.
- The label appears only while 2x mode is active and disappears immediately when long press ends.

Implementation expectations:

- Apply `user-select: none` and equivalent platform-specific protections on player-interactive layers.
- Prevent default long-press/context-menu behavior in the player surface.
- Keep seek bar and explicit button interactions working.

## Liked List Page

The liked section remains list-first:

- Clicking `我的` always opens the liked list page first.
- Clicking an item from the liked list opens the player for that selected liked video.
- From that player, clicking `我的` returns to the liked list page.

### Liked List Presentation

The liked list page is simplified to a content-first layout:

- Remove large hero titles.
- Remove explanatory copy.
- Remove block-style intro sections.
- Keep the page visually lighter and more direct.
- Preserve the video-grid/list browsing behavior.
- Keep only the minimum identifying information needed for item recognition.

### Shared Navigation Language

The liked list page uses the same top-right text navigation language as the player:

- `首页`
- `我的`

This keeps the home-to-liked transition visually coherent even though the liked area remains a list page.

## Routing And State Rules

- Home feed keeps its current random stream behavior and current paging strategy.
- Home feed should retain the current playback position when navigating away and back.
- Liked list remains a separate page from liked-player playback.
- Browser back behavior should remain natural:
  - liked list -> liked player -> browser back returns to liked list
  - switching between `首页` and `我的` follows the route stack already established by the app

## Affected Frontend Areas

Primary files expected to change during implementation:

- `dist/assets/js/components/player.mjs`
- `dist/assets/js/components/likes-grid.mjs`
- `dist/assets/js/app.mjs`
- `dist/assets/styles.css`

No new frontend architecture is required. The implementation should adapt the existing rendering and routing structure.

## Error Handling And Edge Cases

- If there are no home videos, the existing empty-state route behavior may stay, but it should not reintroduce unnecessary heavy player chrome.
- If there are no liked videos, the liked empty state may stay functionally intact, but copy and layout should remain minimal.
- Long-press protection must not break seek interactions or top-right navigation clicks.
- Like button pending state must still prevent duplicate mutations.

## Testing And Verification

Implementation verification must cover:

- Home player renders without the old standalone header block or bottom nav block.
- Top-right `首页 / 我的` navigation routes correctly in both home and liked contexts.
- Left-bottom metadata shows only file name and directory.
- Right side shows only the like button.
- Bottom progress line remains thin and time text remains visible.
- Long-press no longer triggers browser text selection or native callouts.
- `2 倍速播放中` is centered and higher than the current chip position.
- Liked list page still opens first from `我的`.
- Opening a liked item still routes into liked-player playback and back out correctly.
- Existing home paging behavior remains intact: batch size 5, load-more at the third visible item, max 3 attached video sources.

## Scope Control

To keep this task bounded, implementation should avoid:

- redesigning the feed data model
- introducing a new router abstraction
- changing the like API contract
- redesigning unrelated status or empty-state screens unless required for consistency in the touched surfaces

## Implementation Readiness

This spec is ready for implementation planning. There are no unresolved routing questions, unfinished sections, or conflicting interaction decisions remaining from the approved design conversation.
