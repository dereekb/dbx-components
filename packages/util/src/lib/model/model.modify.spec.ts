import { maybeMergeModelModifiers, modifyModelMapFunction } from './model.modify';
import type { ModelMapFunction } from './model.conversion';

interface TestModel {
  name: string;
  value: number;
}

interface TestData {
  name: string;
  value: string;
}

describe('maybeMergeModelModifiers()', () => {
  it('should merge multiple modifiers into one', () => {
    const result = maybeMergeModelModifiers<TestModel, TestData>([{ modifyModel: (x) => (x.name = 'a'), modifyData: (x) => (x.name = 'b') }, { modifyModel: (x) => (x.value = 1) }]);

    expect(result.modifyModel).toBeDefined();
    expect(result.modifyData).toBeDefined();
  });

  it('should handle empty modifiers without error', () => {
    const result = maybeMergeModelModifiers<TestModel, TestData>([{}, {}]);
    expect(result).toBeDefined();
  });
});

describe('modifyModelMapFunction()', () => {
  const baseFn: ModelMapFunction<TestModel, TestData> = (input) => {
    return {
      name: input?.name ?? '',
      value: String(input?.value ?? 0)
    };
  };

  it('should return the original function when no modifier is provided', () => {
    const result = modifyModelMapFunction(baseFn, undefined);
    expect(result).toBe(baseFn);
  });

  it('should apply the modifier before the map function', () => {
    const modified = modifyModelMapFunction(baseFn, (x) => (x.name = 'modified'));
    const result = modified({ name: 'original', value: 1 });

    expect(result.name).toBe('modified');
  });

  it('should shallow-copy the input by default', () => {
    const input: TestModel = { name: 'original', value: 1 };
    const modified = modifyModelMapFunction(baseFn, (x) => (x.name = 'modified'), true);

    modified(input);
    expect(input.name).toBe('original');
  });

  it('should mutate the input when copy is false', () => {
    const input: TestModel = { name: 'original', value: 1 };
    const modified = modifyModelMapFunction(baseFn, (x) => (x.name = 'modified'), false);

    modified(input);
    expect(input.name).toBe('modified');
  });

  it('should not call the modifier for null input', () => {
    let called = false;
    const modified = modifyModelMapFunction(baseFn, () => (called = true));
    modified(null as any);

    expect(called).toBe(false);
  });
});
