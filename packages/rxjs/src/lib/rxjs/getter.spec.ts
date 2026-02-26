import { useAsObservable } from '@dereekb/rxjs';
import { of } from 'rxjs';
import { SubscriptionObject } from '../subscription';
import { callbackTest } from '@dereekb/util/test';

describe('useAsObservable()', () => {
  let sub: SubscriptionObject;

  beforeEach(() => {
    sub = new SubscriptionObject();
  });

  afterEach(() => {
    sub.destroy();
  });

  it(
    'should use the input observable value',
    callbackTest((done) => {
      const value = 0;

      sub.subscription = useAsObservable(of(value), (x) => {
        expect(x).toBe(value);
        done();
      });
    })
  );

  it(
    'should use the input non-observable value',
    callbackTest((done) => {
      const value = 0;

      sub.subscription = useAsObservable(value, (x) => {
        expect(x).toBe(value);
        done();
      });
    })
  );
});
