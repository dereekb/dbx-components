import { StringKeyPropertyKeys } from '@dereekb/util';
import { CommaSeparatedKeyCombinationsOfObject, CommaSeparatedKeysOfObject, KeyAsString, MergeReplace, Replace, ReplaceType, StringKeyProperties } from './type';

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

describe('KeyAsString', () => {
  it('should not allow functions as key strings', () => {
    const x = () => 't';
    const replaced: KeyAsString<typeof x> = undefined as never;
  });
});

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

describe('CommaSeparatedKeyCombinationsOfObject', () => {
  it('should compile', () => {
    const object = {
      a: 0,
      b: 0,
      c: 0,
      d: 0,
      e: 0,
      1: 0
    };

    const replaced: CommaSeparatedKeyCombinationsOfObject<typeof object> = 'a,b,1';
    expect(replaced).toBeDefined();
  });
});

describe('CommaSeparatedKeysOfObject', () => {
  it('should compile', () => {
    const object = {
      a: 0,
      b: 0,
      c: 0,
      _: 0,
      1: 0
    };

    const replaced: CommaSeparatedKeysOfObject<typeof object> = 'a,b,c,1,_';
    expect(replaced).toBeDefined();
  });
});
