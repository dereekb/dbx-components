import { of } from 'rxjs';
import { useFirst } from './use';

describe('useFirst', () => {
  it('should call the function with the first emitted value', () => {
    const fn = vi.fn();

    useFirst(of(42), fn);

    expect(fn).toHaveBeenCalledWith(42);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should only use the first value from multiple emissions', () => {
    const fn = vi.fn();
    const { of: rxOf } = require('rxjs');

    useFirst(rxOf(1, 2, 3), fn);

    expect(fn).toHaveBeenCalledWith(1);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
