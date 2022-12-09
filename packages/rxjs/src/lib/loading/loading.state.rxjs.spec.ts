import { Maybe } from '@dereekb/util';
import { BehaviorSubject } from 'rxjs';
import { filterWithSearchString } from '../rxjs';
import { LoadingState } from './loading.state';
import { mapLoadingStateValueWithOperator } from './loading.state.rxjs';

describe('mapLoadingStateValueWithOperator()', () => {
  it('should map successful values', (done) => {
    const expectedValues = ['aaa', 'aac'];
    const values = [...expectedValues, 'ddd', 'eee'];

    const search$ = new BehaviorSubject<Maybe<string>>('a');
    const values$ = new BehaviorSubject<LoadingState<string[]>>({ value: values });

    const obs = values$.pipe(
      mapLoadingStateValueWithOperator(
        filterWithSearchString({
          filter: (a) => a,
          search$
        })
      )
    );

    obs.subscribe((state) => {
      const { value } = state;

      if (value) {
        expect(value.length).toBe(2);
        expect(value).toContain(expectedValues[0]);
        expect(value).toContain(expectedValues[1]);
        done();
      }
    });
  });

  it('should map loading states', (done) => {
    const search$ = new BehaviorSubject<Maybe<string>>('a');
    const values$ = new BehaviorSubject<LoadingState<string[]>>({ loading: true });

    const obs = values$.pipe(
      mapLoadingStateValueWithOperator(
        filterWithSearchString({
          filter: (a) => a,
          search$
        })
      )
    );

    obs.subscribe((state) => {
      const { loading } = state;
      expect(loading).toBe(true);
      done();
    });
  });
});
