import { of, first } from 'rxjs';
import { tapLog } from './misc';

describe('tapLog', () => {
  it('should pass through values unchanged', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    return new Promise<void>((resolve) => {
      of(42)
        .pipe(tapLog('test:'), first())
        .subscribe((value) => {
          expect(value).toBe(42);
          expect(consoleSpy).toHaveBeenCalledWith('test:', 42);
          consoleSpy.mockRestore();
          resolve();
        });
    });
  });

  it('should support a message function', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    return new Promise<void>((resolve) => {
      of('hello')
        .pipe(
          tapLog((v) => ['value is', v]),
          first()
        )
        .subscribe(() => {
          expect(consoleSpy).toHaveBeenCalledWith('value is', 'hello');
          consoleSpy.mockRestore();
          resolve();
        });
    });
  });

  it('should support warn log level', () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    return new Promise<void>((resolve) => {
      of(1)
        .pipe(tapLog('warn:', 'warn'), first())
        .subscribe(() => {
          expect(consoleSpy).toHaveBeenCalledWith('warn:', 1);
          consoleSpy.mockRestore();
          resolve();
        });
    });
  });
});
