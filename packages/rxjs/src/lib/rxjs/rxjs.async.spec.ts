import { Subject } from 'rxjs';
import { SubscriptionObject } from '../subscription';
import { asyncPusher, type AsyncPusher, asyncPusherCache } from './rxjs.async';

describe('async pusher', () => {
  let pusher: AsyncPusher<number>;
  let sub: SubscriptionObject;

  beforeEach(() => {
    sub = new SubscriptionObject();
  });

  afterEach(() => {
    if (pusher) {
      pusher.destroy();
    }

    sub.destroy();
  });

  describe('asyncPusher()', () => {
    it('should create an AsyncPusher', () => {
      pusher = asyncPusher();

      expect(pusher).toBeDefined();
      expect(typeof pusher).toBe('function');
      expect(pusher.destroy).toBeDefined();
      expect(pusher.watchForCleanup).toBeDefined();
    });

    describe('function', () => {
      it('should return an observable that emits the value.', (done) => {
        const pusher = asyncPusher<number>();

        const obs = pusher(10);
        sub.subscription = obs.subscribe((value) => {
          expect(value).toBe(10);
          done();
        });
      });

      it('should return an observable that throttles values.', (done) => {
        const pusher = asyncPusher<number>();

        const obs = pusher(10);
        pusher(20);
        pusher(30);
        pusher(40);

        const expectedValue = 50;
        pusher(expectedValue);

        sub.subscription = obs.subscribe((value) => {
          expect(value).toBe(expectedValue);
          done();
        });
      });

      describe('watchForCleanup()', () => {
        it('should call destroy when the input observable completes.', (done) => {
          const pusher = asyncPusher<number>();

          const subjectToWatchForCleanup = new Subject();
          pusher.watchForCleanup(subjectToWatchForCleanup);
          subjectToWatchForCleanup.complete();

          sub.subscription = pusher._subject.subscribe({
            complete: () => {
              done();
            }
          });
        });
      });
    });
  });

  describe('asyncPusherCache()', () => {
    it('should create a cache that contains the AsyncPusher', () => {
      const cache = asyncPusherCache<number>();
      pusher = cache();

      expect(pusher).toBeDefined();
      expect(typeof pusher).toBe('function');
      expect(pusher.destroy).toBeDefined();
      expect(pusher.watchForCleanup).toBeDefined();
    });

    it('should create a cache that contains the AsyncPusher and', (done) => {
      const cache = asyncPusherCache<number>();

      const subjectToWatchForCleanup = new Subject();
      pusher = cache(subjectToWatchForCleanup);

      subjectToWatchForCleanup.complete();

      sub.subscription = pusher._subject.subscribe({
        complete: () => {
          done();
        }
      });
    });
  });
});
