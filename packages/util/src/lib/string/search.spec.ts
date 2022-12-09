import { caseInsensitiveFilterByIndexOfDecisionFactory, searchStringFilterFunction } from './search';

describe('searchStringFilterFunction', () => {
  describe('function', () => {
    describe('single-key read configured via function', () => {
      const filterFunction = searchStringFilterFunction((x: string) => x);

      it('should return the values that match the filter', () => {
        const filterText = 'a';
        const values = ['a', 'AA', 'b'];

        const result = filterFunction(filterText, values);
        expect(result).toContain('a');
        expect(result).toContain('AA');
        expect(result).not.toContain('b');
      });

      it('should return the values that match the filter', () => {
        const filterText = 'a';
        const values = ['a', 'AA', 'b'];

        const result = filterFunction(filterText, values);
        expect(result).toContain('a');
        expect(result).toContain('AA');
        expect(result).not.toContain('b');
      });
    });

    describe('single-key read', () => {
      const filterFunction = searchStringFilterFunction<string>({
        readStrings: (x: string) => x,
        decisionFactory: caseInsensitiveFilterByIndexOfDecisionFactory
      });

      it('should return the values that match the filter', () => {
        const filterText = 'a';
        const values = ['a', 'AA', 'b'];

        const result = filterFunction(filterText, values);
        expect(result).toContain('a');
        expect(result).toContain('AA');
        expect(result).not.toContain('b');
      });

      it('should return the values that match the filter', () => {
        const filterText = 'a';
        const values = ['a', 'AA', 'b'];

        const result = filterFunction(filterText, values);
        expect(result).toContain('a');
        expect(result).toContain('AA');
        expect(result).not.toContain('b');
      });
    });

    describe('multi-key read', () => {
      const filterFunction = searchStringFilterFunction<string>({
        readStrings: (x: string) => [x],
        decisionFactory: caseInsensitiveFilterByIndexOfDecisionFactory
      });

      it('should return the values that match the filter', () => {
        const filterText = 'a';
        const values = ['a', 'AA', 'b'];

        const result = filterFunction(filterText, values);
        expect(result).toContain('a');
        expect(result).toContain('AA');
        expect(result).not.toContain('b');
      });

      it('should return the values that match the filter', () => {
        const filterText = 'a';
        const values = ['a', 'AA', 'b'];

        const result = filterFunction(filterText, values);
        expect(result).toContain('a');
        expect(result).toContain('AA');
        expect(result).not.toContain('b');
      });
    });
  });
});
