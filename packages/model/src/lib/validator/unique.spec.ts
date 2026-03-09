import { type Maybe } from '@dereekb/util';
import { type } from 'arktype';
import { uniqueKeyedType } from './unique';

interface TestItem {
  key?: Maybe<string>;
}

const uniqueItemsType = uniqueKeyedType<TestItem>((x) => x.key);

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
