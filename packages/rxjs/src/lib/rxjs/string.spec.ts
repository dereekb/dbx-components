import { Maybe } from '@dereekb/util';
import { BehaviorSubject } from 'rxjs';
import { filterWithSearchString } from './string';

describe('filterWithSearchString()', () => {
  it('should filter the values.', (done) => {
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
  });
});
