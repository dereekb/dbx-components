import { describe, it, expect } from 'vitest';
import { decodeFirebaseServerUserPasswordResetOobCode, encodeFirebaseServerUserPasswordResetOobCode } from './auth.service';

describe('FirebaseServerUserPasswordResetOobCode', () => {
  describe('encode/decode round-trip', () => {
    it('should round-trip a numeric code and uid through encode then decode', () => {
      const uid = 'abc123-XYZ';
      const code = '482910';

      const token = encodeFirebaseServerUserPasswordResetOobCode(uid, code);
      const decoded = decodeFirebaseServerUserPasswordResetOobCode(token);

      expect(decoded).toEqual({ uid, code });
    });
  });

  describe('decode malformed input', () => {
    it('should return undefined for a token with no separator', () => {
      expect(decodeFirebaseServerUserPasswordResetOobCode('no-dash-no-uid'.replace(/-/g, ''))).toBeUndefined();
    });

    it('should return undefined when the code segment is not purely digits', () => {
      expect(decodeFirebaseServerUserPasswordResetOobCode('abc123-someuid')).toBeUndefined();
    });

    it('should return undefined when the uid segment is empty', () => {
      expect(decodeFirebaseServerUserPasswordResetOobCode('123456-')).toBeUndefined();
    });

    it('should return undefined when the code segment is empty', () => {
      expect(decodeFirebaseServerUserPasswordResetOobCode('-someuid')).toBeUndefined();
    });
  });
});
