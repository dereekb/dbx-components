import { first, Subject, toArray } from 'rxjs';
import { type Expires } from '@dereekb/util';
import { SubscriptionObject } from '../subscription';
import { skipAfterExpiration, skipExpired, skipUntilExpiration, skipUntilTimeElapsedAfterLastEmission, takeAfterTimeElapsedSinceLastEmission, toExpiration } from './expires';

describe('expires operators', () => {
  let sub: SubscriptionObject;

  beforeEach(() => {
    sub = new SubscriptionObject();
  });

  afterEach(() => {
    sub.destroy();
  });

  describe('toExpiration()', () => {
    it('should create an Expires object that expires in the future', (done) => {
      const subject = new Subject<number>();
      const expiresIn = 1000; // 1 second

      sub.subscription = subject.pipe(toExpiration(expiresIn), first()).subscribe((expires) => {
        expect(expires).toBeDefined();
        expect(expires.expiresAt).toBeDefined();
        expect(expires.expiresAt instanceof Date).toBe(true);

        // The expiration date should be in the future
        const now = new Date();
        expect(expires.expiresAt!.getTime()).toBeGreaterThan(now.getTime());
        expect(expires.expiresAt!.getTime()).toBeLessThanOrEqual(now.getTime() + expiresIn + 100); // Allow 100ms tolerance

        done();
      });

      subject.next(1);
      subject.complete();
    });

    it('should create a new Expires object on each emission', (done) => {
      const subject = new Subject<number>();
      const expiresIn = 1000;
      const dates: Date[] = [];

      sub.subscription = subject.pipe(toExpiration(expiresIn), toArray()).subscribe((expiresArray) => {
        expect(expiresArray.length).toBe(2);

        expiresArray.forEach((expires) => {
          expect(expires.expiresAt).toBeDefined();
          dates.push(expires.expiresAt!);
        });

        // Each expiration should be slightly different
        expect(dates[0].getTime()).toBeLessThanOrEqual(dates[1].getTime());

        done();
      });

      subject.next(1);
      setTimeout(() => {
        subject.next(2);
        subject.complete();
      }, 10);
    });
  });

  describe('skipExpired()', () => {
    it('should filter out expired items', (done) => {
      const subject = new Subject<Expires>();

      const notExpired: Expires = { expiresAt: new Date(Date.now() + 10000) }; // 10 seconds in future
      const expired: Expires = { expiresAt: new Date(Date.now() - 1000) }; // 1 second in past

      sub.subscription = subject.pipe(skipExpired(), toArray()).subscribe((results) => {
        expect(results.length).toBe(1);
        expect(results[0]).toBe(notExpired);
        done();
      });

      subject.next(expired);
      subject.next(notExpired);
      subject.complete();
    });

    it('should allow items with no expiration date', (done) => {
      const subject = new Subject<Expires>();

      const noExpiration: Expires = { expiresAt: undefined };

      sub.subscription = subject.pipe(skipExpired(), first()).subscribe((result) => {
        expect(result).toBe(noExpiration);
        done();
      });

      subject.next(noExpiration);
      subject.complete();
    });
  });

  describe('skipUntilExpiration()', () => {
    it('should filter out dates until they expire', (done) => {
      const subject = new Subject<Date>();
      const expiresIn = 100; // 100ms

      const futureDate = new Date(Date.now() + 1000); // 1 second in future
      const pastDate = new Date(Date.now() - 200); // 200ms in past (expired with 100ms threshold)

      sub.subscription = subject.pipe(skipUntilExpiration(expiresIn), toArray()).subscribe((results) => {
        expect(results.length).toBe(1);
        expect(results[0]).toBe(pastDate);
        done();
      });

      subject.next(futureDate);
      subject.next(pastDate);
      subject.complete();
    });

    it('should filter all items when expiresIn is not provided (no expiration defined)', (done) => {
      const subject = new Subject<Date>();

      const pastDate = new Date(Date.now() - 1000);
      const futureDate = new Date(Date.now() + 1000);

      sub.subscription = subject.pipe(skipUntilExpiration(), toArray()).subscribe((results) => {
        // Without expiresIn, no expiration is defined, so hasExpired() returns false by default
        // This means nothing passes through the filter
        expect(results.length).toBe(0);
        done();
      });

      subject.next(futureDate);
      subject.next(pastDate);
      subject.complete();
    });
  });

  describe('skipAfterExpiration()', () => {
    it('should filter out dates after they expire', (done) => {
      const subject = new Subject<Date>();
      const expiresIn = 100; // 100ms

      const futureDate = new Date(Date.now() + 1000); // 1 second in future (not expired)
      const pastDate = new Date(Date.now() - 200); // 200ms in past (expired with 100ms threshold)

      sub.subscription = subject.pipe(skipAfterExpiration(expiresIn), toArray()).subscribe((results) => {
        expect(results.length).toBe(1);
        expect(results[0]).toBe(futureDate);
        done();
      });

      subject.next(futureDate);
      subject.next(pastDate);
      subject.complete();
    });

    it('should work without an expiresIn parameter', (done) => {
      const subject = new Subject<Date>();

      const futureDate = new Date(Date.now() + 1000);

      sub.subscription = subject.pipe(skipAfterExpiration(), first()).subscribe((result) => {
        expect(result).toBe(futureDate);
        done();
      });

      subject.next(futureDate);
      subject.complete();
    });
  });

  describe('skipUntilTimeElapsedAfterLastEmission()', () => {
    it('should skip emissions until time has elapsed since last watch emission', (done) => {
      const watchSubject = new Subject<void>();
      const dataSubject = new Subject<number>();
      const takeFor = 50; // 50ms

      const results: number[] = [];

      sub.subscription = dataSubject.pipe(skipUntilTimeElapsedAfterLastEmission(watchSubject, takeFor)).subscribe((value) => {
        results.push(value);
      });

      // First watch emission
      watchSubject.next();
      dataSubject.next(1); // Should be taken (within 50ms)

      setTimeout(() => {
        dataSubject.next(2); // Should be taken (within 50ms)
      }, 20);

      setTimeout(() => {
        dataSubject.next(3); // Should NOT be taken (after 50ms)
        expect(results).toEqual([1, 2]);
        done();
      }, 100);
    });
  });

  describe('takeAfterTimeElapsedSinceLastEmission()', () => {
    it('should take emissions after time has elapsed since last watch emission', (done) => {
      const watchSubject = new Subject<void>();
      const dataSubject = new Subject<number>();
      const skipFor = 50; // 50ms

      const results: number[] = [];

      sub.subscription = dataSubject.pipe(takeAfterTimeElapsedSinceLastEmission(watchSubject, skipFor)).subscribe((value) => {
        results.push(value);
      });

      // First watch emission
      watchSubject.next();
      dataSubject.next(1); // Should be skipped (within 50ms)

      setTimeout(() => {
        dataSubject.next(2); // Should be skipped (within 50ms)
      }, 20);

      setTimeout(() => {
        dataSubject.next(3); // Should be taken (after 50ms)
        expect(results).toEqual([3]);
        done();
      }, 100);
    });
  });
});
