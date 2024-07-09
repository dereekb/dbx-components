import { findBestSplitStringTreeMatch, splitStringTreeFactory } from './tree';

describe('splitStringTreeFactory()', () => {
  describe('factory', () => {
    const factory = splitStringTreeFactory({ separator: '/' });

    it('should generate a tree from the input strings', () => {
      const input = ['a/b/c', 'a/a/a', 'a/b/a', 'b/b/b'];
      const result = factory(input);

      expect(result.children['a']).toBeDefined();
      expect(result.children['a'].fullValue).toBe('a');
      expect(result.children['a'].nodeValue).toBe('a');

      const ab = result.children['a'].children['b'];
      expect(ab).toBeDefined();
      expect(ab.fullValue).toBe('a/b');
      expect(ab.nodeValue).toBe('b');

      const abc = ab.children['c'];
      expect(abc).toBeDefined();
      expect(abc.fullValue).toBe('a/b/c');
      expect(abc.nodeValue).toBe('c');

      const aba = result.children['a'].children['b'].children['a'];
      expect(aba).toBeDefined();
      expect(aba.fullValue).toBe('a/b/a');
      expect(aba.nodeValue).toBe('a');

      const bbb = result.children['b'].children['b'].children['b'];
      expect(bbb).toBeDefined();
      expect(bbb.fullValue).toBe('b/b/b');
      expect(bbb.nodeValue).toBe('b');

      expect(result.children['b']).toBeDefined();
    });

    it('should extend the input value', () => {
      const input = ['a/b/c'];
      const resultA = factory(input);
      const resultB = factory(input, resultA);

      expect(resultA).toBe(resultB);
    });
  });
});

describe('findBestSplitStringTreeMatch()', () => {
  const factory = splitStringTreeFactory({ separator: '/' });

  it('should return the best match for the value in the tree', () => {
    const input = ['a/b/c', 'a/a/a', 'a/b/a', 'b/b/b'];
    const result = factory(input);

    const abcResult = findBestSplitStringTreeMatch(result, 'a/b/c');
    expect(abcResult?.nodeValue).toBe('c');
    expect(abcResult?.fullValue).toBe('a/b/c');
  });

  it('should return undefined if there is no match', () => {
    const input = ['a/b/c', 'a/a/a', 'a/b/a', 'b/b/b'];
    const result = factory(input);

    const abcResult = findBestSplitStringTreeMatch(result, 'ggg/sd');
    expect(abcResult).toBeUndefined();
  });
});
