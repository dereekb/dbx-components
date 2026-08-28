import { utcOffsetString } from './offset';

describe('utcOffsetString()', () => {
  it('should render a negative whole-hour offset.', () => {
    expect(utcOffsetString(-360)).toBe('-0600');
  });

  it('should render a positive half-hour offset.', () => {
    expect(utcOffsetString(330)).toBe('+0530');
  });

  it('should render zero as +0000.', () => {
    expect(utcOffsetString(0)).toBe('+0000');
  });

  it('should render a large positive offset.', () => {
    expect(utcOffsetString(840)).toBe('+1400');
  });

  it('should truncate a fractional minutes value toward zero.', () => {
    expect(utcOffsetString(330.9)).toBe('+0530');
    expect(utcOffsetString(-330.9)).toBe('-0530');
  });
});
