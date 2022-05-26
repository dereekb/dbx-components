import { addMinutes } from 'date-fns';
import { anyHaveExpired, atleastOneNotExpired, hasExpired } from './expires';

describe('expires utility', () => {
  describe('atleastOneNotExpired()', () => {
    it('should return false if any of the expirations have not expired.', () => {
      const expiresAt = null;
      expect(atleastOneNotExpired([{ expiresAt }])).toBe(false);
    });

    it('should return true if any of the expirations have not expired.', () => {
      const expiresAt = addMinutes(new Date(), 1);
      expect(atleastOneNotExpired([{ expiresAt }])).toBe(true);
    });

    it('should return false if the list is empty.', () => {
      expect(atleastOneNotExpired([])).toBe(false);
    });
  });

  describe('anyHaveExpired()', () => {
    it('should return true if any of the expirations have expired.', () => {
      const expiresAt = null;
      expect(anyHaveExpired([{ expiresAt }])).toBe(true);
    });

    it('should return false if none of the expirations have expired.', () => {
      const expiresAt = addMinutes(new Date(), 1);
      expect(anyHaveExpired([{ expiresAt }])).toBe(false);
    });
  });

  describe('hasExpired()', () => {
    it('should return true if the expiration date is null', () => {
      const expiresAt = null;
      expect(hasExpired({ expiresAt })).toBe(true);
    });

    it('should return true if the expiration date is in the past.', () => {
      const expiresAt = addMinutes(new Date(), -1);
      expect(hasExpired({ expiresAt })).toBe(true);
    });

    it('should return false if the expiration date is in the future.', () => {
      const expiresAt = addMinutes(new Date(), 1);
      expect(hasExpired({ expiresAt })).toBe(false);
    });
  });
});
