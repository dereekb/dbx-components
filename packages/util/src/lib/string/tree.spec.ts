import { type SplitStringTree, findBestSplitStringTreeMatch, findBestSplitStringTreeMatchPath, splitStringTreeFactory } from './tree';

describe('splitStringTreeFactory()', () => {
  describe('factory', () => {
    const factory = splitStringTreeFactory({ separator: '/' });

    it('should generate a tree from the input strings', () => {
      const values = ['a/b/c', 'a/a/a', 'a/b/a', 'b/b/b'];
      const result = factory({ values });

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
      const values = ['a/b/c'];
      const resultA = factory({ values });
      const resultB = factory({ values }, resultA);

      expect(resultA).toBe(resultB);
    });

    describe('with meta values', () => {
      describe('no merge meta', () => {
        const factory = splitStringTreeFactory({ separator: '/' });

        it('should replace the meta values for the leaf nodes', () => {
          const metaA = { x: 1, y: 'a' };
          const values = ['a/a/a', 'a/b/a'];
          const resultA = factory({ values, leafMeta: metaA });

          expect(resultA.children['a'].meta).toBeUndefined();
          expect(resultA.children['a'].children['a'].meta).toBeUndefined();
          expect(resultA.children['a'].children['a'].children['a'].meta).toBe(metaA);

          const metaB = { x: 2 };
          const resultB = factory({ values, leafMeta: metaB }, resultA);

          expect(resultB.children['a'].meta).toBeUndefined();
          expect(resultB.children['a'].children['a'].meta).toBeUndefined();
          expect(resultB.children['a'].children['a'].children['a'].meta).toBe(metaB); // check meta was replaced
        });
      });

      describe('mergeMeta', () => {
        interface TestMeta {
          x?: number;
          y?: string;
        }

        const mergeMeta = (a: TestMeta, b: TestMeta) => {
          return a !== b ? { ...a, ...b } : a; // return the same value if a and b are the same
        };

        const factory = splitStringTreeFactory<TestMeta>({ separator: '/', mergeMeta });

        it('should merge the meta values for the leaf nodes', () => {
          const metaA = { x: 1, y: 'a' };
          const values = ['a/a/a', 'a/b/a'];
          const resultA = factory({ values, leafMeta: metaA });

          expect(resultA.children['a'].meta).toBeUndefined();
          expect(resultA.children['a'].children['a'].meta).toBeUndefined();
          expect(resultA.children['a'].children['a'].children['a'].meta).toBe(metaA);

          const metaB = { x: 2 };
          const resultB = factory({ values, leafMeta: metaB }, resultA);

          expect(resultB.children['a'].meta).toBeUndefined();
          expect(resultB.children['a'].children['a'].meta).toBeUndefined();
          expect(resultB.children['a'].children['a'].children['a'].meta?.x).toBe(metaB.x); // check meta was updated
        });

        it('should merge the meta values for all nodes', () => {
          const metaA = { x: 1, y: 'a' };
          const values = ['a/a/a'];
          const resultA = factory({ values, nodeMeta: metaA });

          expect(resultA.children['a'].meta).toBe(metaA);
          expect(resultA.children['a'].children['a'].meta).toBe(metaA);
          expect(resultA.children['a'].children['a'].children['a'].meta).toBe(metaA);

          const metaB = { x: 2 };
          const resultB = factory({ values, nodeMeta: metaB }, resultA);

          expect(resultB.children['a'].meta?.x).toBe(metaB.x); // check meta was updated
          expect(resultB.children['a'].meta?.y).toBe(metaA.y);
          expect(resultB.children['a'].children['a'].meta?.x).toBe(metaB.x); // check meta was updated
          expect(resultB.children['a'].children['a'].children['a'].meta?.x).toBe(metaB.x); // check meta was updated
        });
      });
    });
  });
});

describe('findBestSplitStringTreeMatch()', () => {
  const factory = splitStringTreeFactory({ separator: '/' });

  it('should return the best match for the value in the tree', () => {
    const values = ['a/b/c', 'a/a/a', 'a/b/a', 'b/b/b'];
    const result = factory({ values });

    const abcResult = findBestSplitStringTreeMatch(result, 'a/b/c');
    expect(abcResult?.nodeValue).toBe('c');
    expect(abcResult?.fullValue).toBe('a/b/c');
  });

  it('should return undefined if there is no match', () => {
    const values = ['a/b/c', 'a/a/a', 'a/b/a', 'b/b/b'];
    const result = factory({ values });

    const abcResult = findBestSplitStringTreeMatch(result, 'ggg/sd');
    expect(abcResult).toBeUndefined();
  });
});

describe('findBestSplitStringTreeMatchPath()', () => {
  const factory = splitStringTreeFactory({ separator: '/' });

  it('should return the best match path for the value in the tree', () => {
    const values = ['a/b/c', 'a/a/a', 'a/b/a', 'b/b/b'];
    const result = factory({ values });

    const abcResultPath = findBestSplitStringTreeMatchPath(result, 'a/b/c') as SplitStringTree[];

    expect(abcResultPath).toHaveLength(3);

    expect(abcResultPath[0]?.nodeValue).toBe('a');
    expect(abcResultPath[0]?.fullValue).toBe('a');

    expect(abcResultPath[1]?.nodeValue).toBe('b');
    expect(abcResultPath[1]?.fullValue).toBe('a/b');

    expect(abcResultPath[2]?.nodeValue).toBe('c');
    expect(abcResultPath[2]?.fullValue).toBe('a/b/c');
  });

  it('should return undefined if there is no match', () => {
    const values = ['a/b/c', 'a/a/a', 'a/b/a', 'b/b/b'];
    const result = factory({ values });

    const abcResult = findBestSplitStringTreeMatch(result, 'ggg/sd');
    expect(abcResult).toBeUndefined();
  });
});
