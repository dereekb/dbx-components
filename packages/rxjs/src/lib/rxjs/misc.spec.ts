import { of, first } from 'rxjs';
import { tapLog } from './misc';

describe('tapLog', () => {
  it('should pass through values unchanged', (done) => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    of(42)
      .pipe(tapLog('test:'), first())
      .subscribe((value) => {
        expect(value).toBe(42);
        expect(consoleSpy).toHaveBeenCalledWith('test:', 42);
        consoleSpy.mockRestore();
        done();
      });
  });

  it('should support a message function', (done) => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    of('hello')
      .pipe(
        tapLog((v) => ['value is', v]),
        first()
      )
      .subscribe(() => {
        expect(consoleSpy).toHaveBeenCalledWith('value is', 'hello');
        consoleSpy.mockRestore();
        done();
      });
  });

  it('should support warn log level', (done) => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    of(1)
      .pipe(tapLog('warn:', 'warn'), first())
      .subscribe(() => {
        expect(consoleSpy).toHaveBeenCalledWith('warn:', 1);
        consoleSpy.mockRestore();
        done();
      });
  });
});
