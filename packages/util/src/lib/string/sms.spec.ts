import { describe, expect, it } from 'vitest';
import { smsTextSegmentDetails } from './sms';

describe('smsTextSegmentDetails()', () => {
  it('should report an empty text as zero segments', () => {
    expect(smsTextSegmentDetails('')).toEqual({ length: 0, encoding: 'gsm7', segments: 0 });
  });

  it('should fit 160 GSM-7 characters in one segment', () => {
    expect(smsTextSegmentDetails('a'.repeat(160))).toEqual({ length: 160, encoding: 'gsm7', segments: 1 });
  });

  it('should split a 161 character GSM-7 text into 153 character segments', () => {
    expect(smsTextSegmentDetails('a'.repeat(161))).toEqual({ length: 161, encoding: 'gsm7', segments: 2 });
    expect(smsTextSegmentDetails('a'.repeat(306))).toEqual({ length: 306, encoding: 'gsm7', segments: 2 });
    expect(smsTextSegmentDetails('a'.repeat(307))).toEqual({ length: 307, encoding: 'gsm7', segments: 3 });
  });

  it('should count GSM-7 extension characters as two', () => {
    expect(smsTextSegmentDetails('€{}')).toEqual({ length: 6, encoding: 'gsm7', segments: 1 });
    expect(smsTextSegmentDetails('a'.repeat(158) + '€')).toEqual({ length: 160, encoding: 'gsm7', segments: 1 });
    expect(smsTextSegmentDetails('a'.repeat(159) + '€')).toEqual({ length: 161, encoding: 'gsm7', segments: 2 });
  });

  it('should not split an extension character across segments', () => {
    // 152 + 2 does not fit in the first 153 segment, so the € moves to the second.
    const details = smsTextSegmentDetails('a'.repeat(152) + '€' + 'a'.repeat(152));
    expect(details.length).toBe(306);
    expect(details.segments).toBe(3);
  });

  it('should treat accented GSM-7 basic characters as GSM-7', () => {
    expect(smsTextSegmentDetails('Café à Øslo, Ñoño Müller').encoding).toBe('gsm7');
  });

  it('should switch to UCS-2 for a character outside GSM-7', () => {
    expect(smsTextSegmentDetails('naïve')).toEqual({ length: 5, encoding: 'ucs2', segments: 1 });
    expect(smsTextSegmentDetails('ï'.repeat(70)).segments).toBe(1);
    expect(smsTextSegmentDetails('ï'.repeat(71)).segments).toBe(2);
    expect(smsTextSegmentDetails('ï'.repeat(134)).segments).toBe(2);
    expect(smsTextSegmentDetails('ï'.repeat(135)).segments).toBe(3);
  });

  it('should count an emoji as two UCS-2 units', () => {
    expect(smsTextSegmentDetails('Hello 👋')).toEqual({ length: 8, encoding: 'ucs2', segments: 1 });
    expect(smsTextSegmentDetails('👋'.repeat(35))).toEqual({ length: 70, encoding: 'ucs2', segments: 1 });
    expect(smsTextSegmentDetails('👋'.repeat(36))).toEqual({ length: 72, encoding: 'ucs2', segments: 2 });
  });

  it('should not split a surrogate pair across segments', () => {
    // 66 + 2 does not fit in the first 67 segment, so the emoji moves to the second.
    const details = smsTextSegmentDetails('ï'.repeat(66) + '👋' + 'ï'.repeat(66));
    expect(details.length).toBe(134);
    expect(details.segments).toBe(3);
  });
});
