import { isAllowed } from "./set.allowed";

describe('isAllowed()', () => {

  describe('AllowedSet', () => {

    describe('allowed only', () => {

      it('should return true if allowed is empty/not defined.', () => {
        const allowed = isAllowed([0], {});
        expect(allowed).toBe(true);
      });

      it('should return true if values contains an allowed value.', () => {
        const allowed = isAllowed([0], { allowed: new Set([0]) });
        expect(allowed).toBe(true);
      });

      it('should return false if values does not contain an allowed value.', () => {
        const allowed = isAllowed([1], { allowed: new Set([0]) });
        expect(allowed).toBe(false);
      });

    });

    describe('disallowed only', () => {

      it('should return true if disallowed is empty/not defined.', () => {
        const allowed = isAllowed([0], {});
        expect(allowed).toBe(true);
      });

      it('should return false if values contains a disallowed value.', () => {
        const allowed = isAllowed([0], { disallowed: new Set([0]) });
        expect(allowed).toBe(false);
      });

      it('should return true if values does not contains a disallowed value.', () => {
        const allowed = isAllowed([1], { disallowed: new Set([0]) });
        expect(allowed).toBe(true);
      });

    });

    describe('allowed and disallowed', () => {

      it('should return true if values contains an allowed value that is not a disallowed value.', () => {
        const allowed = isAllowed([0], { allowed: new Set([0]), disallowed: new Set([1]) });
        expect(allowed).toBe(true);
      });

      it('should return false if values does not contains an allowed value that is not a disallowed value.', () => {
        const allowed = isAllowed([2], { allowed: new Set([0]), disallowed: new Set([1]) });
        expect(allowed).toBe(false);
      });

      it('should return false if values contains an allowed value that is a disallowed value.', () => {
        const allowed = isAllowed([0], { allowed: new Set([0]), disallowed: new Set([0]) });
        expect(allowed).toBe(false);
      });

    });

  });

});
