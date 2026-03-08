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
  });
});
