/**
 * Splits extracted PDF text into overlapping character chunks.
 * This is intentionally simple so it is easy to reverse-engineer.
 */
export function chunkText(text, chunkSize = 1200, overlap = 200) {
  const cleaned = text
    .replace(/\r/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (!cleaned) return [];
  if (overlap >= chunkSize) {
    throw new Error("Chunk overlap must be smaller than chunk size");
  }

  const chunks = [];
  let start = 0;

  while (start < cleaned.length) {
    let end = Math.min(start + chunkSize, cleaned.length);

    // Try to end near a paragraph or sentence boundary.
    if (end < cleaned.length) {
      const window = cleaned.slice(start, end);
      const lastBreak = Math.max(
        window.lastIndexOf("\n\n"),
        window.lastIndexOf(". "),
        window.lastIndexOf("? "),
        window.lastIndexOf("! ")
      );

      if (lastBreak > chunkSize * 0.55) {
        end = start + lastBreak + 1;
      }
    }

    const chunk = cleaned.slice(start, end).trim();
    if (chunk) chunks.push(chunk);

    if (end >= cleaned.length) break;
    start = Math.max(end - overlap, start + 1);
  }

  return chunks;
}
