import { MaybeSoStrict, type Maybe, type MaybeMap, type MaybeNot } from './maybe.type';

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

describe('MaybeSoStrict', () => {

  it('should compile for a boolean value', () => {
    const a: MaybeSoStrict<Maybe<boolean>> = true;
    expect(a).toBeDefined();
  });

  it('should compile for a nested object', () => {
    const a: MaybeSoStrict<Maybe<{ a: boolean }>> = null as any;
    expect(a?.a).toBe(null);
  });

  it('should compile for a deeply nested maybe object', () => {
    const a: MaybeSoStrict<Maybe<Maybe<Maybe<{ a: boolean }>>>> = { a: true };
    expect(a.a).toBe(true);
  });

});
