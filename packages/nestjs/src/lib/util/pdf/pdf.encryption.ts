import { PDF_ENCRYPT_MARKER } from '@dereekb/util';
import { createHash, createCipheriv } from 'node:crypto';

/**
 * 32-byte password padding string defined by ISO 32000 §7.6.3.3 (Algorithm 2).
 * Used to pad short or empty user/owner passwords for the standard security handler.
 */
const PDF_PASSWORD_PADDING = Buffer.from([0x28, 0xbf, 0x4e, 0x5e, 0x4e, 0x75, 0x8a, 0x41, 0x64, 0x00, 0x4e, 0x56, 0xff, 0xfa, 0x01, 0x08, 0x2e, 0x2e, 0x00, 0xb6, 0xd0, 0x68, 0x3e, 0x80, 0x2f, 0x0c, 0xa9, 0xfe, 0x64, 0x53, 0x69, 0x7a]);

/**
 * Encryption status returned by {@link detectPdfEncryption}.
 *
 * - `none`: PDF is not encrypted.
 * - `write_protected_only`: PDF carries an `/Encrypt` dictionary but can be opened with
 *   an empty user password — the encryption only restricts editing/printing/etc.
 * - `fully_encrypted`: PDF requires a non-empty user password to be opened.
 * - `unknown_encrypted`: PDF carries an `/Encrypt` dictionary but the encryption
 *   parameters could not be parsed or use a security handler we do not understand.
 *   Treat as encrypted by default.
 */
export type PdfEncryptionStatus = 'none' | 'write_protected_only' | 'fully_encrypted' | 'unknown_encrypted';

/**
 * Detects whether a PDF is unencrypted, write-protected (openable without a password
 * but restricted from editing/printing), or fully encrypted (requires a password to open).
 *
 * Implements the user-password validation algorithms from ISO 32000-1 §7.6.3 (R≤4) and
 * ISO 32000-2 §7.6.4.4 (R=5/6) using only the empty password. If the empty password
 * validates successfully, the PDF is openable by anyone and only its modify/print/copy
 * permissions are restricted; otherwise a non-empty user password is required.
 *
 * Supported security handlers:
 * - Standard security handler, R=2,3,4 (RC4-40, RC4-128, AES-128 with crypt filters).
 * - Standard security handler, R=5 (AES-256, deprecated Adobe extension).
 * - Standard security handler, R=6 (AES-256, ISO 32000-2 / PDF 2.0).
 *
 * Unrecognised security handlers (e.g. PubSec, custom handlers) return
 * `unknown_encrypted` so callers can choose whether to treat them as fully encrypted.
 *
 * Lives in `@dereekb/nestjs` (rather than `@dereekb/util`) because it uses Node's
 * built-in `node:crypto` module, which isn't available in the browser.
 *
 * @example
 * ```ts
 * const status = detectPdfEncryption(buffer);
 *
 * if (status === 'fully_encrypted') {
 *   throw new Error('PDF requires a password to open.');
 * }
 * if (status === 'write_protected_only') {
 *   // Safe to read, but not to mutate without the owner password.
 * }
 * ```
 *
 * @param buffer - PDF file contents.
 * @returns The encryption status of the PDF.
 */
export function detectPdfEncryption(buffer: Buffer): PdfEncryptionStatus {
  let result: PdfEncryptionStatus = 'unknown_encrypted';
  const encryptIndex = findEncryptKeywordIndex(buffer);

  if (encryptIndex < 0) {
    result = 'none';
  } else {
    const dict = extractEncryptionDictionary(buffer, encryptIndex);
    const info = dict ? parseEncryptionInfo(dict) : null;

    if (info?.filter === 'Standard') {
      const opensWithEmptyPassword = checkStandardHandlerEmptyPassword(info, buffer);
      if (opensWithEmptyPassword !== null) {
        result = opensWithEmptyPassword ? 'write_protected_only' : 'fully_encrypted';
      }
    }
  }

  return result;
}

function checkStandardHandlerEmptyPassword(info: PdfEncryptionInfo, buffer: Buffer): boolean | null {
  let result: boolean | null = null;

  if (info.R >= 2 && info.R <= 4) {
    const fileId = extractFirstFileId(buffer);
    if (fileId && info.O.length >= 32 && info.U.length >= 32) {
      result = validateEmptyPasswordR2to4(info, fileId);
    }
  } else if (info.R === 5 && info.U.length >= 48) {
    result = validateEmptyPasswordR5(info);
  } else if (info.R === 6 && info.U.length >= 48) {
    result = validateEmptyPasswordR6(info);
  }

  return result;
}

// MARK: PDF parsing helpers

interface PdfEncryptionInfo {
  readonly filter: string;
  readonly V: number;
  readonly R: number;
  readonly Length: number;
  readonly O: Buffer;
  readonly U: Buffer;
  readonly P: number;
  readonly encryptMetadata: boolean;
}

function isPdfWhitespaceByte(b: number): boolean {
  return b === 0x00 || b === 0x09 || b === 0x0a || b === 0x0c || b === 0x0d || b === 0x20;
}

function isPdfDelimiterByte(b: number): boolean {
  return b === 0x28 || b === 0x29 || b === 0x3c || b === 0x3e || b === 0x5b || b === 0x5d || b === 0x7b || b === 0x7d || b === 0x2f || b === 0x25;
}

function isPdfWhitespaceOrDelimiter(b: number): boolean {
  return isPdfWhitespaceByte(b) || isPdfDelimiterByte(b);
}

function skipPdfWhitespaceAndComments(buffer: Buffer, start: number): number {
  let i = start;
  while (i < buffer.length) {
    const b = buffer[i];
    if (isPdfWhitespaceByte(b)) {
      i++;
    } else if (b === 0x25 /* % */) {
      while (i < buffer.length && buffer[i] !== 0x0a && buffer[i] !== 0x0d) i++;
    } else {
      break;
    }
  }
  return i;
}

function skipPdfLiteralString(buffer: Buffer, start: number): number {
  let depth = 1;
  let i = start + 1;
  while (i < buffer.length && depth > 0) {
    const b = buffer[i];
    if (b === 0x5c /* \ */) {
      i += 2;
    } else if (b === 0x28 /* ( */) {
      depth++;
      i++;
    } else if (b === 0x29 /* ) */) {
      depth--;
      i++;
    } else {
      i++;
    }
  }
  return i;
}

function skipPdfHexString(buffer: Buffer, start: number): number {
  let i = start + 1;
  while (i < buffer.length && buffer[i] !== 0x3e /* > */) i++;
  return i < buffer.length ? i + 1 : i;
}

function findDictEnd(buffer: Buffer, start: number): number {
  let depth = 1;
  let i = start;
  let endIndex = -1;
  while (i < buffer.length && endIndex < 0) {
    const b = buffer[i];
    if (b === 0x3c && buffer[i + 1] === 0x3c) {
      depth++;
      i += 2;
    } else if (b === 0x3e && buffer[i + 1] === 0x3e) {
      depth--;
      if (depth === 0) {
        endIndex = i;
      } else {
        i += 2;
      }
    } else if (b === 0x28) {
      i = skipPdfLiteralString(buffer, i);
    } else if (b === 0x3c) {
      i = skipPdfHexString(buffer, i);
    } else if (b === 0x25) {
      while (i < buffer.length && buffer[i] !== 0x0a && buffer[i] !== 0x0d) i++;
    } else {
      i++;
    }
  }
  return endIndex >= 0 ? endIndex : i;
}

function decodePdfLiteralString(content: Buffer): Buffer {
  const out: number[] = [];
  let i = 0;
  while (i < content.length) {
    const b = content[i];
    if (b !== 0x5c /* \ */) {
      out.push(b);
      i++;
      continue;
    }
    i++;
    if (i >= content.length) break;
    const c = content[i];
    if (c >= 0x30 && c <= 0x37) {
      let oct = c - 0x30;
      i++;
      if (i < content.length && content[i] >= 0x30 && content[i] <= 0x37) {
        oct = oct * 8 + (content[i] - 0x30);
        i++;
        if (i < content.length && content[i] >= 0x30 && content[i] <= 0x37) {
          oct = oct * 8 + (content[i] - 0x30);
          i++;
        }
      }
      out.push(oct & 0xff);
    } else if (c === 0x6e /* n */) {
      out.push(0x0a);
      i++;
    } else if (c === 0x72 /* r */) {
      out.push(0x0d);
      i++;
    } else if (c === 0x74 /* t */) {
      out.push(0x09);
      i++;
    } else if (c === 0x62 /* b */) {
      out.push(0x08);
      i++;
    } else if (c === 0x66 /* f */) {
      out.push(0x0c);
      i++;
    } else if (c === 0x0a) {
      i++;
    } else if (c === 0x0d) {
      i++;
      if (i < content.length && content[i] === 0x0a) i++;
    } else {
      out.push(c);
      i++;
    }
  }
  return Buffer.from(out);
}

function decodePdfHexString(content: Buffer): Buffer {
  const hex: number[] = [];
  for (const b of content) {
    if (isPdfWhitespaceByte(b)) continue;
    if ((b >= 0x30 && b <= 0x39) || (b >= 0x41 && b <= 0x46) || (b >= 0x61 && b <= 0x66)) hex.push(b);
  }
  if (hex.length % 2 === 1) hex.push(0x30);
  const out = Buffer.alloc(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(String.fromCharCode(hex[i * 2], hex[i * 2 + 1]), 16);
  }
  return out;
}

function readPdfNumber(buffer: Buffer, start: number): { value: number; end: number } | null {
  let i = start;
  while (i < buffer.length && !isPdfWhitespaceOrDelimiter(buffer[i])) i++;
  let result: { value: number; end: number } | null = null;
  if (i > start) {
    const text = buffer.toString('latin1', start, i);
    const value = Number(text);
    if (!Number.isNaN(value)) {
      result = { value, end: i };
    }
  }
  return result;
}

interface PdfDictEntry {
  readonly type: 'string' | 'name' | 'number' | 'boolean' | 'null' | 'dict' | 'array' | 'ref';
  readonly raw: Buffer;
}

function parsePdfDict(buffer: Buffer, dictStart: number): { entries: Map<string, PdfDictEntry>; end: number } | null {
  // dictStart is the byte after `<<`.
  const entries = new Map<string, PdfDictEntry>();
  let i = skipPdfWhitespaceAndComments(buffer, dictStart);
  let result: { entries: Map<string, PdfDictEntry>; end: number } | null = null;
  let aborted = false;

  while (i < buffer.length && !aborted && result === null) {
    if (buffer[i] === 0x3e && buffer[i + 1] === 0x3e) {
      result = { entries, end: i + 2 };
    } else if (buffer[i] !== 0x2f /* / */) {
      aborted = true;
    } else {
      const nameStart = i + 1;
      let nameEnd = nameStart;
      while (nameEnd < buffer.length && !isPdfWhitespaceOrDelimiter(buffer[nameEnd])) nameEnd++;
      const name = buffer.toString('latin1', nameStart, nameEnd);
      i = skipPdfWhitespaceAndComments(buffer, nameEnd);

      if (i >= buffer.length) {
        aborted = true;
      } else {
        const valueResult = readPdfValue(buffer, i);
        if (!valueResult) {
          aborted = true;
        } else {
          entries.set(name, valueResult.entry);
          i = skipPdfWhitespaceAndComments(buffer, valueResult.end);
        }
      }
    }
  }

  return result;
}

type PdfValueResult = { entry: PdfDictEntry; end: number };

function readPdfValue(buffer: Buffer, start: number): PdfValueResult | null {
  const b = buffer[start];
  let result: PdfValueResult | null;

  if (b === 0x3c && buffer[start + 1] === 0x3c) {
    result = readPdfDictValue(buffer, start);
  } else if (b === 0x3c) {
    result = readPdfHexStringValue(buffer, start);
  } else if (b === 0x28) {
    result = readPdfLiteralStringValue(buffer, start);
  } else if (b === 0x5b /* [ */) {
    result = readPdfArrayValue(buffer, start);
  } else if (b === 0x2f /* / */) {
    result = readPdfNameValue(buffer, start);
  } else {
    result = readPdfTokenOrRefValue(buffer, start);
  }

  return result;
}

function readPdfDictValue(buffer: Buffer, start: number): PdfValueResult {
  const dictEnd = findDictEnd(buffer, start + 2);
  const end = dictEnd < buffer.length && buffer[dictEnd] === 0x3e && buffer[dictEnd + 1] === 0x3e ? dictEnd + 2 : dictEnd;
  return { entry: { type: 'dict', raw: buffer.subarray(start, end) }, end };
}

function readPdfHexStringValue(buffer: Buffer, start: number): PdfValueResult {
  const end = skipPdfHexString(buffer, start);
  return { entry: { type: 'string', raw: decodePdfHexString(buffer.subarray(start + 1, end - 1)) }, end };
}

function readPdfLiteralStringValue(buffer: Buffer, start: number): PdfValueResult {
  const end = skipPdfLiteralString(buffer, start);
  return { entry: { type: 'string', raw: decodePdfLiteralString(buffer.subarray(start + 1, end - 1)) }, end };
}

function readPdfArrayValue(buffer: Buffer, start: number): PdfValueResult {
  let depth = 1;
  let i = start + 1;
  while (i < buffer.length && depth > 0) {
    const c = buffer[i];
    if (c === 0x5b) {
      depth++;
      i++;
    } else if (c === 0x5d) {
      depth--;
      i++;
    } else if (c === 0x28) {
      i = skipPdfLiteralString(buffer, i);
    } else if (c === 0x3c && buffer[i + 1] === 0x3c) {
      const e = findDictEnd(buffer, i + 2);
      i = e < buffer.length && buffer[e] === 0x3e && buffer[e + 1] === 0x3e ? e + 2 : e;
    } else if (c === 0x3c) {
      i = skipPdfHexString(buffer, i);
    } else if (c === 0x25) {
      while (i < buffer.length && buffer[i] !== 0x0a && buffer[i] !== 0x0d) i++;
    } else {
      i++;
    }
  }
  return { entry: { type: 'array', raw: buffer.subarray(start, i) }, end: i };
}

function readPdfNameValue(buffer: Buffer, start: number): PdfValueResult {
  let i = start + 1;
  while (i < buffer.length && !isPdfWhitespaceOrDelimiter(buffer[i])) i++;
  return { entry: { type: 'name', raw: buffer.subarray(start + 1, i) }, end: i };
}

function readPdfTokenOrRefValue(buffer: Buffer, start: number): PdfValueResult {
  // Number, boolean, null, or indirect reference like `12 0 R`.
  let i = start;
  while (i < buffer.length && !isPdfWhitespaceOrDelimiter(buffer[i])) i++;
  const tokenEnd = i;
  const token = buffer.toString('latin1', start, tokenEnd);

  const referenceEnd = readIndirectReferenceEnd(buffer, tokenEnd);
  let result: PdfValueResult;

  if (referenceEnd !== null) {
    result = { entry: { type: 'ref', raw: buffer.subarray(start, referenceEnd) }, end: referenceEnd };
  } else if (token === 'true' || token === 'false') {
    result = { entry: { type: 'boolean', raw: buffer.subarray(start, tokenEnd) }, end: tokenEnd };
  } else if (token === 'null') {
    result = { entry: { type: 'null', raw: buffer.subarray(start, tokenEnd) }, end: tokenEnd };
  } else {
    result = { entry: { type: 'number', raw: buffer.subarray(start, tokenEnd) }, end: tokenEnd };
  }

  return result;
}

function readIndirectReferenceEnd(buffer: Buffer, tokenEnd: number): number | null {
  // Probe ahead for `GEN R` after a leading object number to detect `N G R`.
  let result: number | null = null;
  const probe = skipPdfWhitespaceAndComments(buffer, tokenEnd);

  if (probe < buffer.length) {
    const c = buffer[probe];
    if (c >= 0x30 && c <= 0x39) {
      let secondEnd = probe;
      while (secondEnd < buffer.length && !isPdfWhitespaceOrDelimiter(buffer[secondEnd])) secondEnd++;
      const probe2 = skipPdfWhitespaceAndComments(buffer, secondEnd);
      if (probe2 < buffer.length && buffer[probe2] === 0x52 /* R */ && (probe2 + 1 === buffer.length || isPdfWhitespaceOrDelimiter(buffer[probe2 + 1]))) {
        result = probe2 + 1;
      }
    }
  }

  return result;
}

function findEncryptKeywordIndex(buffer: Buffer): number {
  const marker = PDF_ENCRYPT_MARKER;
  let last = -1;
  let pos = 0;
  while (true) {
    const found = buffer.indexOf(marker, pos);
    if (found < 0) break;
    const next = buffer[found + marker.length];
    // Avoid matching `/EncryptMetadata` (a different name).
    const isAlpha = (next >= 0x41 && next <= 0x5a) || (next >= 0x61 && next <= 0x7a);
    if (!isAlpha) last = found;
    pos = found + marker.length;
  }
  return last;
}

function extractEncryptionDictionary(buffer: Buffer, encryptIndex: number): Buffer | null {
  let result: Buffer | null = null;
  let i = encryptIndex + PDF_ENCRYPT_MARKER.length;
  i = skipPdfWhitespaceAndComments(buffer, i);

  if (i < buffer.length) {
    if (buffer[i] === 0x3c && buffer[i + 1] === 0x3c) {
      // Inline dictionary.
      const dictEnd = findDictEnd(buffer, i + 2);
      result = buffer.subarray(i, dictEnd + 2);
    } else {
      // Indirect reference: `N G R`.
      result = resolveIndirectEncryptionDictionary(buffer, i);
    }
  }

  return result;
}

function resolveIndirectEncryptionDictionary(buffer: Buffer, start: number): Buffer | null {
  let result: Buffer | null = null;
  const numResult = readPdfNumber(buffer, start);

  if (numResult) {
    const afterFirst = skipPdfWhitespaceAndComments(buffer, numResult.end);
    const genResult = readPdfNumber(buffer, afterFirst);

    if (genResult) {
      const afterSecond = skipPdfWhitespaceAndComments(buffer, genResult.end);
      if (buffer[afterSecond] === 0x52 /* R */) {
        const objStart = findIndirectObjectStart(buffer, numResult.value, genResult.value);
        if (objStart >= 0) {
          const dictStart = buffer.indexOf('<<', objStart);
          if (dictStart >= 0) {
            const dictEnd = findDictEnd(buffer, dictStart + 2);
            result = buffer.subarray(dictStart, dictEnd + 2);
          }
        }
      }
    }
  }

  return result;
}

function findIndirectObjectStart(buffer: Buffer, objNum: number, objGen: number): number {
  const text = buffer.toString('latin1');
  const re = new RegExp(`(?:^|[\\r\\n\\s])${objNum}\\s+${objGen}\\s+obj\\b`);
  const match = re.exec(text);
  return match ? match.index + match[0].length : -1;
}

function parseEncryptionInfo(dictBuffer: Buffer): PdfEncryptionInfo | null {
  // `dictBuffer` is the full `<< ... >>`; pass the body to parsePdfDict.
  let result: PdfEncryptionInfo | null = null;
  const isDict = dictBuffer.length >= 4 && dictBuffer[0] === 0x3c && dictBuffer[1] === 0x3c;
  const parsed = isDict ? parsePdfDict(dictBuffer, 2) : null;

  if (parsed) {
    const entries = parsed.entries;
    const filter = readNameValue(entries.get('Filter')) ?? '';
    const V = readNumberValue(entries.get('V')) ?? 0;
    const R = readNumberValue(entries.get('R')) ?? 0;
    const Length = readNumberValue(entries.get('Length')) ?? (V >= 5 ? 256 : 40);
    const O = readStringValue(entries.get('O')) ?? Buffer.alloc(0);
    const U = readStringValue(entries.get('U')) ?? Buffer.alloc(0);
    const P = readNumberValue(entries.get('P')) ?? 0;
    const encryptMetadataEntry = entries.get('EncryptMetadata');
    const encryptMetadata = encryptMetadataEntry ? (readBooleanValue(encryptMetadataEntry) ?? true) : true;

    if (R !== 0 && V !== 0) {
      result = { filter, V, R, Length, O, U, P, encryptMetadata };
    }
  }

  return result;
}

function readNumberValue(entry: PdfDictEntry | undefined): number | null {
  let result: number | null = null;
  if (entry?.type === 'number') {
    const value = Number(entry.raw.toString('latin1'));
    if (!Number.isNaN(value)) {
      result = value;
    }
  }
  return result;
}

function readNameValue(entry: PdfDictEntry | undefined): string | null {
  return entry?.type === 'name' ? entry.raw.toString('latin1') : null;
}

function readStringValue(entry: PdfDictEntry | undefined): Buffer | null {
  return entry?.type === 'string' ? entry.raw : null;
}

function readBooleanValue(entry: PdfDictEntry): boolean | null {
  return entry.type === 'boolean' ? entry.raw.toString('latin1') === 'true' : null;
}

function extractFirstFileId(buffer: Buffer): Buffer | null {
  // The /ID array lives in the trailer or the cross-reference stream dictionary.
  // Walk the buffer right-to-left to find the most recent /ID array.
  let result: Buffer | null = null;
  let pos = buffer.length;
  let done = false;

  while (pos > 0 && !done) {
    const found = buffer.lastIndexOf('/ID', pos);
    if (found < 0) {
      done = true;
    } else {
      const after = found + 3;
      const isExactName = after >= buffer.length || isPdfWhitespaceOrDelimiter(buffer[after]);

      if (isExactName) {
        let i = skipPdfWhitespaceAndComments(buffer, after);
        if (buffer[i] === 0x5b /* [ */) {
          i = skipPdfWhitespaceAndComments(buffer, i + 1);
          const valueResult = readPdfValue(buffer, i);
          if (valueResult?.entry.type === 'string') {
            result = valueResult.entry.raw;
            done = true;
          }
        }
      }

      if (!done) {
        pos = found - 1;
      }
    }
  }

  return result;
}

// MARK: Standard security handler — empty-password validation

function rc4(key: Uint8Array, data: Uint8Array) {
  const S = new Uint8Array(256);
  for (let i = 0; i < 256; i++) S[i] = i;
  let j = 0;
  for (let i = 0; i < 256; i++) {
    j = (j + S[i] + key[i % key.length]) & 0xff;
    const t = S[i];
    S[i] = S[j];
    S[j] = t;
  }
  const out = Buffer.alloc(data.length);
  let ii = 0;
  let jj = 0;
  for (const [n, byte] of data.entries()) {
    ii = (ii + 1) & 0xff;
    jj = (jj + S[ii]) & 0xff;
    const t = S[ii];
    S[ii] = S[jj];
    S[jj] = t;
    out[n] = byte ^ S[(S[ii] + S[jj]) & 0xff];
  }
  return out;
}

function computeFileEncryptionKeyR2to4(info: PdfEncryptionInfo, password: Buffer, fileId: Buffer): Buffer {
  const padded = Buffer.alloc(32);
  password.copy(padded, 0, 0, Math.min(password.length, 32));
  if (password.length < 32) PDF_PASSWORD_PADDING.copy(padded, password.length, 0, 32 - password.length);

  const md5 = createHash('md5');
  md5.update(padded);
  md5.update(info.O);
  const pBytes = Buffer.alloc(4);
  pBytes.writeInt32LE(info.P | 0, 0);
  md5.update(pBytes);
  md5.update(fileId);
  if (info.R >= 4 && !info.encryptMetadata) md5.update(Buffer.from([0xff, 0xff, 0xff, 0xff]));
  let key = md5.digest();

  const keyBytes = Math.min(Math.floor(info.Length / 8), key.length);
  if (info.R >= 3) {
    for (let i = 0; i < 50; i++) {
      key = createHash('md5').update(key.subarray(0, keyBytes)).digest();
    }
  }
  return key.subarray(0, keyBytes);
}

function validateEmptyPasswordR2to4(info: PdfEncryptionInfo, fileId: Buffer): boolean {
  const password = Buffer.alloc(0);
  const key = computeFileEncryptionKeyR2to4(info, password, fileId);
  let matches: boolean;

  if (info.R === 2) {
    const expected = rc4(key, PDF_PASSWORD_PADDING);
    matches = constantTimeEquals(expected, info.U.subarray(0, 32));
  } else {
    let computed = createHash('md5').update(PDF_PASSWORD_PADDING).update(fileId).digest();
    computed = rc4(key, computed);
    for (let i = 1; i <= 19; i++) {
      const xorKey = Buffer.alloc(key.length);
      for (let j = 0; j < key.length; j++) xorKey[j] = key[j] ^ i;
      computed = rc4(xorKey, computed);
    }
    matches = constantTimeEquals(computed, info.U.subarray(0, 16));
  }

  return matches;
}

function validateEmptyPasswordR5(info: PdfEncryptionInfo): boolean {
  const validationSalt = info.U.subarray(32, 40);
  const computed = createHash('sha256').update(validationSalt).digest();
  return constantTimeEquals(computed, info.U.subarray(0, 32));
}

function validateEmptyPasswordR6(info: PdfEncryptionInfo): boolean {
  const validationSalt = info.U.subarray(32, 40);
  const password = Buffer.alloc(0);
  const computed = pdfAlgorithm2B(Buffer.concat([password, validationSalt]), password, Buffer.alloc(0));
  return constantTimeEquals(computed, info.U.subarray(0, 32));
}

function pdfAlgorithm2B(input: Buffer, password: Buffer, userKey: Buffer): Buffer {
  let K = createHash('sha256').update(input).digest();
  let round = 0;
  let lastE: Buffer = Buffer.alloc(0);

  while (true) {
    const part = Buffer.concat([password, K, userKey]);
    const K1 = Buffer.alloc(part.length * 64);
    for (let i = 0; i < 64; i++) part.copy(K1, i * part.length);

    const cipher = createCipheriv('aes-128-cbc', K.subarray(0, 16), K.subarray(16, 32));
    cipher.setAutoPadding(false);
    const E = Buffer.concat([cipher.update(K1), cipher.final()]);
    lastE = E;

    let n = 0;
    for (let i = 0; i < 16; i++) n = (n * 256 + E[i]) % 3;

    if (n === 0) K = createHash('sha256').update(E).digest();
    else if (n === 1) K = createHash('sha384').update(E).digest();
    else K = createHash('sha512').update(E).digest();

    round++;
    if (round >= 64 && lastE[lastE.length - 1] <= round - 32) break;
  }
  return K.subarray(0, 32);
}

function constantTimeEquals(a: Buffer, b: Buffer): boolean {
  let result = false;
  if (a.length === b.length) {
    let diff = 0;
    for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
    result = diff === 0;
  }
  return result;
}
