import { type } from 'arktype';
import { unitedStatesAddressWithStateCodeType, unitedStatesAddressWithStateStringType } from './address';

describe('unitedStatesAddressWithStateCodeType', () => {
  describe('validation', () => {
    it('should validate valid input', () => {
      const result = unitedStatesAddressWithStateCodeType({
        line1: 'valid',
        city: 'valid',
        zip: '77834',
        state: 'TX'
      });
      expect(result instanceof type.errors).toBe(false);
    });

    it('should validate input with a null line2 value', () => {
      const result = unitedStatesAddressWithStateCodeType({
        line1: 'valid',
        line2: null,
        city: 'valid',
        zip: '77834',
        state: 'TX'
      });
      expect(result instanceof type.errors).toBe(false);
    });

    it('should validate input with an undefined line2 value', () => {
      const result = unitedStatesAddressWithStateCodeType({
        line1: 'valid',
        line2: undefined,
        city: 'valid',
        zip: '77834',
        state: 'TX'
      });
      expect(result instanceof type.errors).toBe(false);
    });

    it('should reject invalid state code', () => {
      const result = unitedStatesAddressWithStateCodeType({
        line1: 'valid',
        city: 'valid',
        zip: '77834',
        state: 'Texas'
      });
      expect(result instanceof type.errors).toBe(true);
    });
  });
});

describe('unitedStatesAddressWithStateStringType', () => {
  describe('validation', () => {
    it('should validate valid input', () => {
      const result = unitedStatesAddressWithStateStringType({
        line1: 'valid',
        city: 'valid',
        zip: '77834',
        state: 'Texas'
      });
      expect(result instanceof type.errors).toBe(false);
    });

    it('should validate input with a null line2 value', () => {
      const result = unitedStatesAddressWithStateStringType({
        line1: 'valid',
        line2: null,
        city: 'valid',
        zip: '77834',
        state: 'Texas'
      });
      expect(result instanceof type.errors).toBe(false);
    });

    it('should validate input with an undefined line2 value', () => {
      const result = unitedStatesAddressWithStateStringType({
        line1: 'valid',
        line2: undefined,
        city: 'valid',
        zip: '77834',
        state: 'Texas'
      });
      expect(result instanceof type.errors).toBe(false);
    });
  });
});
