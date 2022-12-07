import { dollarAmountString, isDollarAmountString } from './dollar';

describe('isDollarAmountString()', () => {
  it('should return true for numbers without a decimal', () => {
    const string = '100';
    const result = isDollarAmountString(string);
    expect(result).toBe(true);
  });

  it('should return true for numbers with two decimal places', () => {
    const string = '100.51';
    const result = isDollarAmountString(string);
    expect(result).toBe(true);
  });

  it('should return false for numbers with a decimal period', () => {
    const string = '100.';
    const result = isDollarAmountString(string);
    expect(result).toBe(false);
  });

  it('should return false for numbers with one decimal place', () => {
    const string = '100.1';
    const result = isDollarAmountString(string);
    expect(result).toBe(false);
  });

  it('should return false for numbers with three decimal places', () => {
    const string = '100.111';
    const result = isDollarAmountString(string);
    expect(result).toBe(false);
  });
});

describe('dollarAmountString()', () => {
  it('should convert a number to a dollar amount string.', () => {
    const number = 100;
    const result = dollarAmountString(number);
    expect(result).toBe('100.00');
  });

  it('should convert a number with a 10-cent decimal to a dollar amount string.', () => {
    const number = 100.5;
    const result = dollarAmountString(number);
    expect(result).toBe('100.50');
  });

  it('should convert a number with a decimal to a dollar amount string.', () => {
    const number = 100.51;
    const result = dollarAmountString(number);
    expect(result).toBe('100.51');
  });

  it('should convert a number with a decimal that has extra digits to a number with the extra precision removed.', () => {
    const number = 100.515;
    const result = dollarAmountString(number);
    expect(result).toBe('100.51');
  });
});
