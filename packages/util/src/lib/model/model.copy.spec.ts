import { makeCopyModelFieldFunction, objectHasKey } from '@dereekb/util';

interface TestCopyModel {
  name: string;
  test?: boolean;
}

describe('makeCopyModelFieldFunction()', () => {

  const testModel: TestCopyModel = {
    name: 'test',
    test: true
  };

  describe('function', () => {

    it('should copy the configured field if it is defined in the object.', () => {
      const fn = makeCopyModelFieldFunction<TestCopyModel>('name');

      const target: Partial<TestCopyModel> = {};
      fn(testModel, target);

      expect(target.name).toBe(testModel.name);
    });

    it('should not copy the configured field if it is not defined in the object.', () => {
      const fn = makeCopyModelFieldFunction<TestCopyModel>('name');

      const target: Partial<TestCopyModel> = {};
      fn({}, target);

      expect(objectHasKey(target, 'name')).toBe(false);
    });

    it('should set the default value if null is passed in.', () => {
      const defaultValue = 'def';
      const fn = makeCopyModelFieldFunction<TestCopyModel>('name', { default: defaultValue });

      const target: Partial<TestCopyModel> = {};
      fn({}, target);

      expect(target.name).toBe(defaultValue);
    });

  });

});
