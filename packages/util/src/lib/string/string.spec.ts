import { splitJoinRemainder } from './string';

describe('splitJoinRemainder()', () => {
  it('should handle having a single value', () => {
    const values = ['a'];
    const string = values.join(',');

    const result = splitJoinRemainder(string, ',', 3);
    expect(result[0]).toBe(values[0]);
  });

  it('should split the value up to the limit (1) and join the remainder', () => {
    const values = ['a,b,c,d,e'];
    const string = values.join(',');

    const result = splitJoinRemainder(string, ',', 1);
    expect(result[0]).toBe(values[0]);
  });

  it('should split the value up to the limit (2) and join the remainder', () => {
    const values = ['a', 'b,c,d,e'];
    const string = values.join(',');

    const result = splitJoinRemainder(string, ',', 2);
    expect(result[0]).toBe(values[0]);
    expect(result[1]).toBe(values[1]);
  });

  it('should split the value up to the limit (3) and join the remainder', () => {
    const values = ['a', 'b', 'c,d,e'];
    const string = values.join(',');

    const result = splitJoinRemainder(string, ',', 3);
    expect(result[0]).toBe(values[0]);
    expect(result[1]).toBe(values[1]);
    expect(result[2]).toBe(values[2]);
  });

  it('should split the value up to the limit (8) and join the remainder', () => {
    const values = ['a', 'b', 'c', 'd', 'e'];
    const string = values.join(',');

    const result = splitJoinRemainder(string, ',', 8);
    expect(result[0]).toBe(values[0]);
    expect(result[1]).toBe(values[1]);
    expect(result[2]).toBe(values[2]);
    expect(result[3]).toBe(values[3]);
    expect(result[4]).toBe(values[4]);
  });
});
