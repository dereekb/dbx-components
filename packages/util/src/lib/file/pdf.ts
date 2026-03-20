/**
 * Returns true if the buffer appears to have the markings of a valid PDF.
 *
 * Checks for two structural markers defined by the PDF specification (ISO 32000):
 * - `%PDF-` header at the start of the buffer, which identifies the file as a PDF document.
 * - `%%EOF` marker somewhere in the buffer, which signals the end of a PDF file.
 *
 * This is a lightweight heuristic check, not a full validation. A buffer that passes
 * this check is not guaranteed to be a well-formed or uncorrupted PDF — it only confirms
 * the expected start/end markers are present.
 *
 * @param buffer - Buffer-like object to check. Only requires the `lastIndexOf` method.
 * @returns true if both PDF markers are found in the expected positions.
 */
export function bufferHasValidPdfMarkings(buffer: Pick<Buffer<ArrayBuffer>, 'lastIndexOf' | 'includes'>) {
  return buffer.lastIndexOf('%PDF-') === 0 && buffer.includes('%%EOF');
}
