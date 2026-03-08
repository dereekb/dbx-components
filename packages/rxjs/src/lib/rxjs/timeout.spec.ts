import { first, of, Subject } from 'rxjs';
import { SubscriptionObject } from '../subscription';
import { timeoutStartWith } from './timeout';
import { callbackTest } from '@dereekb/util/test';

describe('timeoutStartWith', () => {
  let sub: SubscriptionObject;

  beforeEach(() => {
    sub = new SubscriptionObject();
  });

  afterEach(() => {
    sub.destroy();
  });

  it(
    'should emit the default value if the source does not emit in time',
    callbackTest((done) => {
      const source = new Subject<string>();

      sub.subscription = source.pipe(timeoutStartWith('default', 50), first()).subscribe((value) => {
        expect(value).toBe('default');
        done();
      });
    })
  );

  it(
    'should pass through the source value when it emits quickly',
    callbackTest((done) => {
      sub.subscription = of('quick')
        .pipe(timeoutStartWith('default', 1000), first())
        .subscribe((value) => {
          expect(value).toBe('quick');
          done();
        });
    })
  );
});
