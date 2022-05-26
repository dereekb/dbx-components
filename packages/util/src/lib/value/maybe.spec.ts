import { Maybe, MaybeMap, MaybeNot } from './maybe';

describe('MaybeMap', () => {
  it('should compile', () => {
    const a: MaybeMap<{
      aOnly: boolean;
      test: boolean;
      maybe: Maybe<string>;
      maybenot: MaybeNot;
    }> = {
      aOnly: true,
      test: null,
      maybe: ''
    };

    expect(a).toBeDefined();
  });
});
