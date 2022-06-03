import { StringKeyPropertyKeys } from '@dereekb/util';
import { MergeReplace, Replace, ReplaceType, StringKeyProperties } from './type';

type TYPE_A = {
  aOnly: boolean;
  test: boolean;
};

type TYPE_B = {
  test: string;
  notInA: boolean;
};

type TYPE_C = {
  test: string;
  200: number;
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

describe('StringKeyProperties', () => {
  it('should compile', () => {
    const replaced: StringKeyProperties<TYPE_C> = {
      test: 'replaced'
    };

    expect(replaced).toBeDefined();
  });
});

describe('StringKeyPropertyKeys', () => {
  it('should compile', () => {
    const replaced: StringKeyPropertyKeys<TYPE_C> = 'test';
    expect(replaced).toBeDefined();
  });
});
