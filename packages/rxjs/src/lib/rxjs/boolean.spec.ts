import { first, Subject } from 'rxjs';
import { SubscriptionObject } from '../subscription';
import { onFalseToTrue, onTrueToFalse } from './boolean';

describe('boolean operators', () => {

  let subject: Subject<boolean>;
  let sub: SubscriptionObject;

  beforeEach(() => {
    subject = new Subject<boolean>();
    sub = new SubscriptionObject();
  });

  afterEach(() => {
    sub.destroy();
    subject.complete();
  });

  describe('onTrueToFalse', () => {

    const from = true;
    const to = false;

    it('should emit when "true" becomes "false"', (done) => {

      sub.subscription = subject.pipe(
        onTrueToFalse(),
        first()
      ).subscribe((value) => {
        expect(value).toBe(to);
        done();
      });

      subject.next(from);
      subject.next(to);
    });

  });

  describe('onFalseToTrue', () => {

    const from = false;
    const to = true;

    it('should emit when "false" becomes "true"', (done) => {

      sub.subscription = subject.pipe(
        onFalseToTrue(),
        first()
      ).subscribe((value) => {
        expect(value).toBe(to);
        done();
      });

      subject.next(from);
      subject.next(to);
    });

  });

})
