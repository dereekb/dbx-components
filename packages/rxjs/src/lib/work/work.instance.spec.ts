import { SubscriptionObject } from './../subscription';
import { beginLoading, errorResult, type LoadingState, successResult } from '@dereekb/rxjs';
import { type Maybe, readableError } from '@dereekb/util';
import { filter, BehaviorSubject, first } from 'rxjs';
import { WorkInstance } from './work.instance';

const TEST_ERROR_CODE = 'test';

describe('WorkInstance', () => {
  let sub: SubscriptionObject;
  let workInstance: WorkInstance<number, string>;

  beforeEach(() => {
    workInstance = new WorkInstance(1, {
      startWorking: () => 0,
      success: () => 0,
      reject: () => 0
    });
    sub = new SubscriptionObject();
  });

  afterEach(() => {
    workInstance.destroy();
    sub.destroy();
  });

  describe('before starting work', () => {
    it('hasStarted should return false', () => {
      expect(workInstance.hasStarted).toBe(false);
    });

    it('isComplete should return false', () => {
      expect(workInstance.isComplete).toBe(false);
    });

    describe('destroy()', () => {
      beforeEach(() => {
        workInstance.destroy();
      });

      it('hasStarted should return false', () => {
        expect(workInstance.hasStarted).toBe(false);
      });

      it('isComplete should return true', () => {
        expect(workInstance.isComplete).toBe(true);
      });
    });
  });

  describe('startWorkingWithLoadingStateObservable()', () => {
    let loadingStateObs: BehaviorSubject<Maybe<LoadingState<string>>>;

    beforeEach(() => {
      loadingStateObs = new BehaviorSubject<Maybe<LoadingState<string>>>(undefined);
    });

    afterEach(() => {
      loadingStateObs.next(beginLoading()); // pass to prevent
      loadingStateObs.complete();
    });

    it('should only start working when the loading state passes a defined value.', () => {
      workInstance.startWorkingWithLoadingStateObservable(loadingStateObs);
      expect(workInstance.hasStarted).toBe(false);
    });

    it('should start working when the loading state begins loading.', (done) => {
      workInstance.startWorkingWithLoadingStateObservable(loadingStateObs);
      expect(workInstance.hasStarted).toBe(false);

      loadingStateObs.next(beginLoading());

      workInstance.hasStarted$
        .pipe(
          filter((x) => x),
          first()
        )
        .subscribe((hasStarted) => {
          expect(hasStarted).toBe(true);
          done();
        });
    });

    it('should be marked complete if the loading state has success.', (done) => {
      workInstance.startWorkingWithLoadingStateObservable(loadingStateObs);
      loadingStateObs.next(successResult('test'));

      workInstance.isComplete$
        .pipe(
          filter((x) => x),
          first()
        )
        .subscribe((isComplete) => {
          expect(isComplete).toBe(true);
          done();
        });
    });

    it('should be marked complete if the loading state has an error.', (done) => {
      workInstance.startWorkingWithLoadingStateObservable(loadingStateObs);
      loadingStateObs.next(errorResult(readableError('test', 'test')));

      workInstance.isComplete$
        .pipe(
          filter((x) => x),
          first()
        )
        .subscribe((isComplete) => {
          expect(isComplete).toBe(true);
          done();
        });
    });

    it('should be marked complete if the loading state begins loading and then has success.', (done) => {
      loadingStateObs.next(beginLoading());
      workInstance.startWorkingWithLoadingStateObservable(loadingStateObs);

      workInstance.isComplete$
        .pipe(
          filter((x) => x),
          first()
        )
        .subscribe((isComplete) => {
          expect(isComplete).toBe(true);
          done();
        });

      setTimeout(() => {
        loadingStateObs.next(successResult('test'));
      }, 10);
    });
  });

  describe('after starting work', () => {
    beforeEach(() => {
      workInstance.startWorking();
    });

    it('hasStarted should return true', () => {
      expect(workInstance.hasStarted).toBe(true);
    });

    it('isComplete should return false', () => {
      expect(workInstance.isComplete).toBe(false);
    });

    describe('after success', () => {
      beforeEach(() => {
        workInstance.success();
      });

      it('isComplete should return true', () => {
        expect(workInstance.isComplete).toBe(true);
      });
    });

    describe('after error', () => {
      beforeEach(() => {
        workInstance.reject(readableError(TEST_ERROR_CODE));
      });

      it('isComplete should return true', () => {
        expect(workInstance.isComplete).toBe(true);
      });
    });
  });
});
