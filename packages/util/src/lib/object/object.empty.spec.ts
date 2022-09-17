import { objectIsEmpty } from './object.empty';
import { areEqualPOJOValues } from './object.equal';

describe('objectIsEmpty()', () => {
  it('should return false for a simple object.', () => {
    const a = { a: 'a' };
    expect(objectIsEmpty(a)).toBe(false);
  });
});
