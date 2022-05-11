import { getValueFromGetter, GetterOrValueWithInput } from './getter';

describe('getValueFromGetter()', () => {

  describe('GetterOrValueWithInput', () => {

    it('should return the value', () => {
      const x: GetterOrValueWithInput<number, number> = 0;
      const result = getValueFromGetter(x);
      expect(result).toBe(x);
    });

    it('should return the value from a getter', () => {
      const value = 10;
      const x: GetterOrValueWithInput<number, number> = () => value;
      const result = getValueFromGetter(x);
      expect(result).toBe(value);
    });

    it('should return the value from a getter with arguments', () => {
      const getter: GetterOrValueWithInput<number, number> = (v?: number) => v ?? 0;
      const value = 10;
      const result = getValueFromGetter(getter, value);
      expect(result).toBe(value);
    });

  });

});
