import { unique } from './array.unique';

describe('unique', () => {
  it('should return only unique values', () => {
    const values = [0, 1, 2, 3, 4];

    const result = unique([...values, ...values]);

    expect(result.length).toBe(values.length);
    values.forEach((x) => expect(result).toContain(x));
  });

  it('should exclude any excluded values', () => {
    const values = [0, 1, 2, 3, 4];

    const result = unique(values, values);

    expect(result.length).toBe(0);
  });
});
