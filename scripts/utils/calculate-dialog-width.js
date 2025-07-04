/**
 * Calculate dialog width based on card count, card width, and spacing.
 * @param {number} cardCount - Number of cards to display
 * @param {number} cardWidth - Width of a single card in pixels
 * @param {boolean} outer - If true, include outer spacing; if false, only include internal spacing
 * @param {number} gap - Gap in pixels between cards (default: 8)
 * @returns {number} - The calculated dialog width in pixels
 */
export function calculateDialogWidth(cardCount, cardWidth, outer = true, gap = 8) {
  if (cardCount <= 0 || cardWidth <= 0) return 0;
  const spacing = outer ? (cardCount + 1) * gap : (cardCount - 1) * gap;
  return cardCount * cardWidth + spacing;
}
