import { MergeReplace, Replace, ReplaceType } from './type';

type TYPE_A = {
  aOnly: boolean;
  test: boolean;
};

type TYPE_B = {
  test: string;
  notInA: boolean;
};

describe('MergeReplace', () => {
  it('should compile', () => {
    const replaced: MergeReplace<TYPE_A, TYPE_B> = {
      aOnly: true,
      test: 'replaced',
      notInA: false
    };

    expect(replaced).toBeDefined();
  });
});

describe('Replace', () => {
  it('should compile', () => {
    const replaced: Replace<TYPE_A, TYPE_B> = {
      aOnly: true,
      test: 'replaced'
    };

    expect(replaced).toBeDefined();
  });
});

describe('ReplaceType', () => {
  it('should compile', () => {
    const replaced: ReplaceType<TYPE_A, TYPE_B> = {
      aOnly: 'any value',
      test: 'replaced'
    };

    expect(replaced).toBeDefined();
  });
});
