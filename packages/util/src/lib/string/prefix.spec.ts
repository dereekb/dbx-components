import { characterPrefixSuffixInstance } from './prefix';

describe('characterPrefixSuffixInstance()', () => {
  describe('with prefix only', () => {
    const instance = characterPrefixSuffixInstance({
      prefix: '-'
    });

    describe('prefixSuffixString()', () => {
      it('should add prefix to string', () => {
        expect(instance.prefixSuffixString('test')).toBe('-test');
      });

      it('should clean string before adding prefix', () => {
        expect(instance.prefixSuffixString('-test')).toBe('-test');
        expect(instance.prefixSuffixString('--test')).toBe('-test');
      });
    });

    describe('cleanString()', () => {
      it('should remove prefix from string', () => {
        expect(instance.cleanString('-test')).toBe('test');
      });

      it('should remove multiple occurrences of prefix', () => {
        expect(instance.cleanString('--test')).toBe('test');
        expect(instance.cleanString('---test')).toBe('test');
      });

      it('should return string as is if no prefix is present', () => {
        expect(instance.cleanString('test')).toBe('test');
      });
    });
  });

  describe('with suffix only', () => {
    const instance = characterPrefixSuffixInstance({
      suffix: '-'
    });

    describe('prefixSuffixString()', () => {
      it('should add suffix to string', () => {
        expect(instance.prefixSuffixString('test')).toBe('test-');
      });

      it('should clean string before adding suffix', () => {
        expect(instance.prefixSuffixString('test-')).toBe('test-');
        expect(instance.prefixSuffixString('test--')).toBe('test-');
      });
    });

    describe('cleanString()', () => {
      it('should remove suffix from string', () => {
        expect(instance.cleanString('test-')).toBe('test');
      });

      it('should remove multiple occurrences of suffix', () => {
        expect(instance.cleanString('test--')).toBe('test');
        expect(instance.cleanString('test---')).toBe('test');
      });

      it('should return string as is if no suffix is present', () => {
        expect(instance.cleanString('test')).toBe('test');
      });
    });
  });

  describe('with prefix and suffix', () => {
    const instance = characterPrefixSuffixInstance({
      prefix: '#',
      suffix: '!'
    });

    describe('prefixSuffixString()', () => {
      it('should add prefix and suffix to string', () => {
        expect(instance.prefixSuffixString('test')).toBe('#test!');
      });

      it('should clean string before adding prefix and suffix', () => {
        expect(instance.prefixSuffixString('#test!')).toBe('#test!');
        expect(instance.prefixSuffixString('##test!!')).toBe('#test!');
      });
    });

    describe('cleanString()', () => {
      it('should remove prefix and suffix from string', () => {
        expect(instance.cleanString('#test!')).toBe('test');
      });

      it('should remove multiple occurrences of prefix and suffix', () => {
        expect(instance.cleanString('##test!')).toBe('test');
        expect(instance.cleanString('#test!!')).toBe('test');
        expect(instance.cleanString('##test!!')).toBe('test');
      });

      it('should return string as is if no prefix or suffix is present', () => {
        expect(instance.cleanString('test')).toBe('test');
      });
    });
  });

  describe('with empty prefix and suffix', () => {
    const instance = characterPrefixSuffixInstance({});

    describe('prefixSuffixString()', () => {
      it('should return string as is', () => {
        expect(instance.prefixSuffixString('test')).toBe('test');
      });
    });

    describe('cleanString()', () => {
      it('should return string as is', () => {
        expect(instance.cleanString('test')).toBe('test');
      });
    });
  });

  describe('with complex prefix and suffix', () => {
    const instance = characterPrefixSuffixInstance({
      prefix: '<<',
      suffix: '>>'
    });

    describe('prefixSuffixString()', () => {
      it('should add complex prefix and suffix to string', () => {
        expect(instance.prefixSuffixString('test')).toBe('<<test>>');
      });
    });

    describe('cleanString()', () => {
      it('should remove complex prefix and suffix from string', () => {
        expect(instance.cleanString('<<test>>')).toBe('test');
      });

      it('should remove multiple occurrences of complex prefix and suffix', () => {
        expect(instance.cleanString('<<<<<test>>>>>')).toBe('<test>');
      });
    });
  });

  describe('with empty string input', () => {
    describe('default behavior', () => {
      const instance = characterPrefixSuffixInstance({
        prefix: '-',
        suffix: '+'
      });

      it('should return empty string in prefixSuffixString() by default', () => {
        expect(instance.prefixSuffixString('')).toBe('');
      });

      it('should handle empty string in cleanString()', () => {
        expect(instance.cleanString('')).toBe('');
      });
    });

    describe('with prefixEmptyString=true', () => {
      const instance = characterPrefixSuffixInstance({
        prefix: '-',
        suffix: '+',
        prefixEmptyString: true
      });

      it('should add only prefix to empty string', () => {
        expect(instance.prefixSuffixString('')).toBe('-');
      });
    });

    describe('with suffixEmptyString=true', () => {
      const instance = characterPrefixSuffixInstance({
        prefix: '-',
        suffix: '+',
        suffixEmptyString: true
      });

      it('should add only suffix to empty string', () => {
        expect(instance.prefixSuffixString('')).toBe('+');
      });
    });

    describe('with both prefixEmptyString and suffixEmptyString=true', () => {
      const instance = characterPrefixSuffixInstance({
        prefix: '-',
        suffix: '+',
        prefixEmptyString: true,
        suffixEmptyString: true
      });

      it('should add both prefix and suffix to empty string', () => {
        expect(instance.prefixSuffixString('')).toBe('-+');
      });
    });
  });
});
