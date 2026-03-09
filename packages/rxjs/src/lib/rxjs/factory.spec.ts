import { first } from 'rxjs';
import { factoryTimer } from './factory';
import { callbackTest } from '@dereekb/util/test';

describe('factoryTimer', () => {
  it(
    'should emit factory-produced values',
    callbackTest((done) => {
      const obs = factoryTimer({
        factory: (i) => i * 10,
        interval: 50,
        limit: 1
      });

      obs.pipe(first()).subscribe((value) => {
        expect(value).toBe(0);
        done();
      });
    })
  );

  it(
    'should respect the limit',
    callbackTest((done) => {
      const results: number[] = [];

      factoryTimer({
        factory: (i) => i,
        interval: 10,
        limit: 3
      }).subscribe({
        next: (value) => results.push(value),
        complete: () => {
          expect(results).toEqual([0, 1, 2]);
          done();
        }
      });
    })
  );
});
