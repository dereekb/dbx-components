import { modelFieldMapFunction } from './model.conversion';
import { copyField } from './model.conversion.field';

describe('copyField()', () => {
  it('should create a config with from and to conversions', () => {
    const config = copyField('default');
    expect(config.from).toBeDefined();
    expect(config.to).toBeDefined();
  });

  describe('compiled functions', () => {
    const config = copyField(0);
    const fromFn = modelFieldMapFunction(config.from);
    const toFn = modelFieldMapFunction(config.to);

    it('should copy the same value across in the from direction', () => {
      const result = fromFn(42);
      expect(result).toBe(42);
    });

    it('should copy the same value across in the to direction', () => {
      const result = toFn(42);
      expect(result).toBe(42);
    });

    it('should return the default value when input is undefined (from)', () => {
      const result = fromFn(undefined);
      expect(result).toBe(0);
    });

    it('should return the default value when input is undefined (to)', () => {
      const result = toFn(undefined);
      expect(result).toBe(0);
    });

    it('should run the example successfully', () => {
      const nameField = copyField('');
      const fromCompiled = modelFieldMapFunction(nameField.from);
      const toCompiled = modelFieldMapFunction(nameField.to);

      expect(fromCompiled('hello')).toBe('hello');
      expect(toCompiled('hello')).toBe('hello');
      expect(fromCompiled(undefined)).toBe('');
    });
  });
});
