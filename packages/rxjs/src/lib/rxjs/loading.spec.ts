import { BehaviorSubject, first } from 'rxjs';
import { isLoading } from './loading';
import { callbackTest } from '@dereekb/util/test';

describe('isLoading', () => {
  it('should emit true initially then false once the source emits', () => {
    return new Promise<void>((resolve) => {
      const results: boolean[] = [];
      const source = new BehaviorSubject<string>('data');

      source.pipe(isLoading()).subscribe({
        next: (value) => {
          results.push(value);

          if (results.length === 2) {
            expect(results[0]).toBe(true);
            expect(results[1]).toBe(false);
            resolve();
          }
        }
      });
    });
  });

  it(
    'should emit true when the source has not yet emitted',
    callbackTest((done) => {
      const source = new BehaviorSubject<string>('value');
      source.pipe(isLoading(), first()).subscribe((value) => {
        expect(value).toBe(true);
        done();
      });
    })
  );
});
