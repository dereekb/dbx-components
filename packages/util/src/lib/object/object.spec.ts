import { filterFromPOJO, objectHasKey } from './object';

describe('filterFromPOJO()', () => {

  it('should remove undefined values from the object by default', () => {
    const result = filterFromPOJO({ x: undefined, y: 'test' });
    expect(objectHasKey(result, 'x')).toBe(false);
    expect(objectHasKey(result, 'y')).toBe(false);
  });

});
