import { objectIsEmpty } from './object.empty';

describe('objectIsEmpty()', () => {
  it('should return false for a simple object.', () => {
    const a = { a: 'a' };
    expect(objectIsEmpty(a)).toBe(false);
  });
});
