import { SubscriptionObject } from './subscription';
import { LockSet } from './lock';
import { filter, first, of } from 'rxjs';

describe('LockSet', () => {

  let lockSet: LockSet;
  let sub: SubscriptionObject;

  beforeEach(() => {
    lockSet = new LockSet();
    sub = new SubscriptionObject();
  });

  afterEach(() => {
    lockSet.destroy();
    sub.destroy();
  });

  describe('addLock', () => {

    it('should add a lock to the lock set with the given key.', (done) => {
      const key = 'test';

      sub.subscription = lockSet.locks$.pipe(filter(x => x.size > 0), first()).subscribe((locks) => {
        expect(locks.get(key)).toBeDefined();
        expect(locks.size).toBe(1);
        done();
      });

      lockSet.addLock(key, of(true));
    });

  });

  describe('isLocked$', () => {

    it('should be locked if any child observable is true.', (done) => {
      const key = 'test';

      lockSet.addLock(key, of(true));
      lockSet.addLock(key + 'b', of(false));
      lockSet.addLock(key + 'c', of(false));

      lockSet.locks$.pipe(filter(x => x.size > 2), first()).subscribe((locks) => {
        expect(locks.size).toBe(3);

        sub.subscription = lockSet.isLocked$.pipe().subscribe((isLocked) => {
          expect(isLocked).toBe(true);
          done();
        });
      });

    });

    it('should not be locked if all child observables are false.', (done) => {
      const key = 'test';

      lockSet.addLock(key, of(false));
      lockSet.addLock(key + 'b', of(false));
      lockSet.addLock(key + 'c', of(false));

      sub.subscription = lockSet.isLocked$.pipe(first()).subscribe((isLocked) => {
        expect(isLocked).toBe(false);
        done();
      });
    });

  });

  describe('setParentLockSet', () => {

    let parentLockSet: LockSet;

    beforeEach(() => {
      parentLockSet = new LockSet();
    });

    it('should add the lockset as a child of the input parent lock set.', (done) => {

      parentLockSet.locks$.pipe(first()).subscribe((locks) => {
        expect(locks.size).toBe(0);

        lockSet.setParentLockSet(parentLockSet);

        sub.subscription = parentLockSet.locks$.pipe(filter(x => x.size > 0), first()).subscribe((locks) => {
          expect(locks.size).toBe(1);
          done();
        });
      });

    });

  });

});
