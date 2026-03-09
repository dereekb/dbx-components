import { type Maybe } from '@dereekb/util';
import { type } from 'arktype';
import { uniqueKeyedType } from './unique';

interface TestItem {
  key?: Maybe<string>;
}

const uniqueItemsType = uniqueKeyedType<TestItem>((x) => x.key);

describe('uniqueKeyedType used in merge', () => {
  const testType = type({
    items: uniqueItemsType,
    name: 'string'
  });

  it('should validate an object with unique items.', () => {
    const result = testType({ items: [{ key: 'a' }, { key: 'b' }], name: 'test' });
    expect(result instanceof type.errors).toBe(false);
  });

  it('should fail when items have duplicate keys.', () => {
    const result = testType({ items: [{ key: 'a' }, { key: 'a' }], name: 'test' });
    expect(result instanceof type.errors).toBe(true);
  });
});

describe('uniqueKeyedType', () => {
  it('should pass if the keys are unique', () => {
    const result = uniqueItemsType([{ key: 'a' }, { key: 'b' }, { key: 'c' }]);
    expect(result instanceof type.errors).toBe(false);
  });

  it('should pass if the keys are unique and some are undefined', () => {
    const result = uniqueItemsType([{ key: 'a' }, { key: 'b' }, {}]);
    expect(result instanceof type.errors).toBe(false);
  });

  it('should not pass if one or more keys are duplicated', () => {
    const result = uniqueItemsType([{ key: 'a' }, { key: 'a' }, { key: 'c' }]);
    expect(result instanceof type.errors).toBe(true);
  });
});
