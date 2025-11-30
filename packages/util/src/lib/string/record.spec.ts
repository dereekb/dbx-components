import { invertStringRecord } from './record';

describe('invertStringRecord', () => {
  it('should invert the record', () => {
    const record = {
      a: 'b',
      c: 'd',
      e: 'f'
    };

    const inverted = invertStringRecord(record);

    expect(inverted).toEqual({
      b: 'a',
      d: 'c',
      f: 'e'
    });
  });
});
