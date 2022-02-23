import { timeout, timeoutWith } from 'rxjs/operators';
import { ListLoadingStateContextInstance, successResult } from '@dereekb/rxjs';
import { first, of } from 'rxjs';

describe(' ListLoadingStateContextInstance', () => {

  let context: ListLoadingStateContextInstance;

  beforeEach(() => {
    context = new ListLoadingStateContextInstance();
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
