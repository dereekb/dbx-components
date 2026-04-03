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

/**
 * Checks whether a PDF buffer is password-protected by looking for the `/Encrypt`
 * dictionary entry in the PDF content.
 *
 * Per the PDF specification (ISO 32000), a password-protected (encrypted) PDF includes
 * an `/Encrypt` entry in its trailer or cross-reference stream dictionary. This function
 * performs a simple string search for that marker.
 *
 * Like {@link bufferHasValidPdfMarkings}, this is a lightweight heuristic — it detects
 * the vast majority of encrypted PDFs but does not fully parse the PDF structure.
 *
 * @example
 * ```ts
 * const pdfBytes = await readFile('protected.pdf');
 * const buffer = Buffer.from(pdfBytes);
 *
 * if (isPdfPasswordProtected(buffer)) {
 *   throw new Error('Password-protected PDFs are not supported.');
 * }
 * ```
 *
 * @param buffer - Buffer-like object to check. Only requires the `includes` method.
 * @returns true if the buffer contains a `/Encrypt` entry indicating password protection.
 */
export function isPdfPasswordProtected(buffer: Pick<Buffer<ArrayBuffer>, 'includes'>) {
  const result = buffer.includes('/Encrypt');
  return result;
}
