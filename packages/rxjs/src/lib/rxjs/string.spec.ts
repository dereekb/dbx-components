import { type Maybe } from '@dereekb/util';
import { BehaviorSubject } from 'rxjs';
import { filterWithSearchString } from './string';
import { callbackTest } from '@dereekb/util/test';

describe('filterWithSearchString()', () => {
  it(
    'should filter the values.',
    callbackTest((done) => {
      const expectedValues = ['aaa', 'aac'];
      const values = [...expectedValues, 'ddd', 'eee'];

      const search$ = new BehaviorSubject<Maybe<string>>('a');
      const values$ = new BehaviorSubject<string[]>(values);

      const obs = values$.pipe(
        filterWithSearchString({
          filter: (a) => a,
          search$
        })
      );

      obs.subscribe((values) => {
        expect(values.length).toBe(2);
        expect(values).toContain(expectedValues[0]);
        expect(values).toContain(expectedValues[1]);
        done();
      });
    })
  );
});
