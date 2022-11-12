import { validate } from 'class-validator';
import { UnitedStatesAddressWithStateCodeParams, UnitedStatesAddressWithStateStringParams } from './address';

describe('UnitedStatesAddressWithStateCodeParams', () => {
  describe('validation', () => {
    it('should validate the input', async () => {
      const model = new UnitedStatesAddressWithStateCodeParams();
      model.line1 = 'valid';
      model.city = 'valid';
      model.zip = '77834';
      model.state = 'TX';

      const result = await validate(model);
      expect(result.length).toBe(0);
    });

    it('should validate the state code', async () => {
      const model = new UnitedStatesAddressWithStateCodeParams();
      model.line1 = 'valid';
      model.city = 'valid';
      model.zip = '77834';
      model.state = 'Texas';

      const result = await validate(model);
      expect(result.length).toBe(1);
      expect(result[0].property).toBe('state');
    });
  });
});

describe('UnitedStatesAddressWithStateStringParams', () => {
  describe('validation', () => {
    it('should validate the input', async () => {
      const model = new UnitedStatesAddressWithStateStringParams();
      model.line1 = 'valid';
      model.city = 'valid';
      model.zip = '77834';
      model.state = 'Texas';

      const result = await validate(model);
      expect(result.length).toBe(0);
    });
  });
});
