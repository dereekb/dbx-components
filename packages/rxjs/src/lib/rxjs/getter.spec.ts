import { useAsObservable } from '@dereekb/rxjs';
import { of } from 'rxjs';
import { SubscriptionObject } from '../subscription';

describe('useAsObservable()', () => {
  let sub: SubscriptionObject;

  beforeEach(() => {
    sub = new SubscriptionObject();
  });

  afterEach(() => {
    sub.destroy();
  });

  it('should use the input observable value', (done) => {
    const value = 0;

    sub.subscription = useAsObservable(of(value), (x) => {
      expect(x).toBe(value);
      done();
    });
  });

  it('should use the input non-observable value', (done) => {
    const value = 0;

    sub.subscription = useAsObservable(value, (x) => {
      expect(x).toBe(value);
      done();
    });
  });
});
