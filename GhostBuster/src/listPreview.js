/** Default number of list items shown before "View more" */
export const LIST_PREVIEW_LIMIT = 5

export function previewSlice(items, showAll, limit = LIST_PREVIEW_LIMIT) {
  if (showAll) return items
  return items.slice(0, limit)
}

export function previewHiddenCount(items, showAll, limit = LIST_PREVIEW_LIMIT) {
  if (showAll) return 0
  return Math.max(0, items.length - limit)
}
