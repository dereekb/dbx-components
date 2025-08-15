import { findTypeformTemplateRefsInString } from './typeform.util';

describe('findTypeformFieldRefsInString', () => {
  describe('scenarios', () => {
    it('should find no field refs in a string with no ref', () => {
      const input = 'And what was *your completion result* at field?';
      const result = findTypeformTemplateRefsInString(input);

      expect(result).toEqual([]);
    });

    it('should find the field ref in a string with a uuid ref', () => {
      const input = 'And what was *your completion result* at {{field:8f7adc1e-c3b8-44bd-b00c-1b6c8de65797}}?';
      const result = findTypeformTemplateRefsInString(input);

      expect(result).toEqual([
        {
          type: 'field',
          match: '{{field:8f7adc1e-c3b8-44bd-b00c-1b6c8de65797}}',
          ref: '8f7adc1e-c3b8-44bd-b00c-1b6c8de65797'
        }
      ]);
    });

    it('should find the field ref in a string with a ref', () => {
      const input = 'And what was *your completion result* at {{field:01H7G3DCZ1FZV4KYZGM755MXZZ}}?';
      const result = findTypeformTemplateRefsInString(input);

      expect(result).toEqual([
        {
          type: 'field',
          match: '{{field:01H7G3DCZ1FZV4KYZGM755MXZZ}}',
          ref: '01H7G3DCZ1FZV4KYZGM755MXZZ'
        }
      ]);
    });

    it('should find the two field refs in a string', () => {
      const input = 'And what was *your completion result* at {{field:8f7adc1e-c3b8-44bd-b00c-1b6c8de65797}}? What about {{field:01H7G3DCZ1FZV4KYZGM755MXZZ}}?';
      const result = findTypeformTemplateRefsInString(input);

      expect(result).toEqual([
        {
          type: 'field',
          match: '{{field:8f7adc1e-c3b8-44bd-b00c-1b6c8de65797}}',
          ref: '8f7adc1e-c3b8-44bd-b00c-1b6c8de65797'
        },
        {
          type: 'field',
          match: '{{field:01H7G3DCZ1FZV4KYZGM755MXZZ}}',
          ref: '01H7G3DCZ1FZV4KYZGM755MXZZ'
        }
      ]);
    });
  });
});
