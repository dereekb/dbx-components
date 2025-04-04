import { ListLoadingStateContext, MutableListLoadingStateContext } from './loading.context.state.list';
import { listLoadingStateContext, successResult } from '@dereekb/rxjs';
import { timeout, first, of } from 'rxjs';

describe('listLoadingStateContext()', () => {
  let context: MutableListLoadingStateContext;

  beforeEach(() => {
    context = listLoadingStateContext();
  });

  afterEach(() => {
    context.destroy();
  });

  describe('isEmpty$', () => {
    it('should not emit until a value has been passed.', (done) => {
      context.isEmpty$.pipe(first(), timeout({ first: 200, with: () => of(0) })).subscribe((isEmpty) => {
        expect(isEmpty).toBe(0);
        done();
      });
    });

    it('should return true if the value is an empty list.', (done) => {
      context.setStateObs(of(successResult([])));

      context.isEmpty$.pipe(first()).subscribe((isEmpty) => {
        expect(isEmpty).toBe(true);
        done();
      });
    });

    it('should return false if the value is an empty list.', (done) => {
      context.setStateObs(of(successResult(['a'])));

      context.isEmpty$.pipe(first()).subscribe((isEmpty) => {
        expect(isEmpty).toBe(false);
        done();
      });
    });
  });
});
