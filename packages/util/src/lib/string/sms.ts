/**
 * The encoding a carrier uses to send an SMS.
 *
 * - `gsm7`: the GSM 03.38 7-bit default alphabet. Used when every character is in the basic or extension table.
 * - `ucs2`: UTF-16. Used as soon as any character falls outside GSM-7, which shrinks every segment.
 */
export type SmsTextEncoding = 'gsm7' | 'ucs2';

/**
 * Characters a single GSM-7 segment holds.
 */
export const SMS_GSM7_SINGLE_SEGMENT_LENGTH = 160;

/**
 * Characters each segment of a split GSM-7 message holds. The rest of the segment is the concatenation header.
 */
export const SMS_GSM7_MULTI_SEGMENT_LENGTH = 153;

/**
 * UTF-16 code units a single UCS-2 segment holds.
 */
export const SMS_UCS2_SINGLE_SEGMENT_LENGTH = 70;

/**
 * UTF-16 code units each segment of a split UCS-2 message holds.
 */
export const SMS_UCS2_MULTI_SEGMENT_LENGTH = 67;

/**
 * The GSM 03.38 basic character table. Each character counts as one.
 */
const SMS_GSM7_BASIC_CHARACTERS = new Set('@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà');

/**
 * The GSM 03.38 extension table. Each character is sent as an escape plus the character, so it counts as two.
 */
const SMS_GSM7_EXTENSION_CHARACTERS = new Set('^{}\\[~]|€\f');

/**
 * Length and segment details for an SMS body.
 */
export interface SmsTextSegmentDetails {
  /**
   * The length the carrier counts, in the encoding's units: GSM-7 septets (extension characters count as two) or UTF-16 code units.
   */
  readonly length: number;
  /**
   * The encoding the text is sent with.
   */
  readonly encoding: SmsTextEncoding;
  /**
   * The number of segments the text is sent as. An empty text is 0 segments.
   */
  readonly segments: number;
}

/**
 * Returns the length, encoding and segment count of an SMS body.
 *
 * - GSM-7 when every character is in the GSM 03.38 basic or extension table, otherwise UCS-2.
 * - GSM-7 fits 160 characters in one segment and 153 per segment when split. Extension characters (`^{}\[~]|€`) count as two.
 * - UCS-2 fits 70 code units in one segment and 67 per segment when split. Characters outside the BMP (most emoji) count as two.
 * - A split never divides an extension character or a surrogate pair, so a segment may end one unit short.
 *
 * @param text - The SMS body.
 * @returns The length, encoding and segment count.
 *
 * @dbxUtil
 * @dbxUtilCategory string
 * @dbxUtilTags sms, text, segment, gsm7, ucs2, length, encoding, twilio
 *
 * @example
 * ```ts
 * smsTextSegmentDetails('Hello!');
 * // { length: 6, encoding: 'gsm7', segments: 1 }
 *
 * smsTextSegmentDetails('Hello 👋');
 * // { length: 8, encoding: 'ucs2', segments: 1 }
 * ```
 */
export function smsTextSegmentDetails(text: string): SmsTextSegmentDetails {
  const characters = Array.from(text);
  const isGsm7 = characters.every((x) => SMS_GSM7_BASIC_CHARACTERS.has(x) || SMS_GSM7_EXTENSION_CHARACTERS.has(x));

  let encoding: SmsTextEncoding;
  let units: number[];
  let singleSegmentLength: number;
  let multiSegmentLength: number;

  if (isGsm7) {
    encoding = 'gsm7';
    units = characters.map((x) => (SMS_GSM7_EXTENSION_CHARACTERS.has(x) ? 2 : 1));
    singleSegmentLength = SMS_GSM7_SINGLE_SEGMENT_LENGTH;
    multiSegmentLength = SMS_GSM7_MULTI_SEGMENT_LENGTH;
  } else {
    encoding = 'ucs2';
    units = characters.map((x) => x.length);
    singleSegmentLength = SMS_UCS2_SINGLE_SEGMENT_LENGTH;
    multiSegmentLength = SMS_UCS2_MULTI_SEGMENT_LENGTH;
  }

  const length = units.reduce((sum, x) => sum + x, 0);
  let segments: number;

  if (length === 0) {
    segments = 0;
  } else if (length <= singleSegmentLength) {
    segments = 1;
  } else {
    segments = 1;
    let segmentLength = 0;

    for (const unit of units) {
      if (segmentLength + unit > multiSegmentLength) {
        segments += 1;
        segmentLength = 0;
      }

      segmentLength += unit;
    }
  }

  return { length, encoding, segments };
}
