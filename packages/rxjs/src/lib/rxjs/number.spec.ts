import { Subject } from 'rxjs';
import { SubscriptionObject } from '../subscription';
import { scanCount } from './number';

describe('scanCount', () => {
  let sub: SubscriptionObject;

  beforeEach(() => {
    sub = new SubscriptionObject();
  });

  afterEach(() => {
    sub.destroy();
  });

  it('should count emissions starting from 0', () => {
    const subject = new Subject<unknown>();
    const results: number[] = [];

    sub.subscription = subject.pipe(scanCount()).subscribe((value) => results.push(value));

    subject.next('a');
    subject.next('b');
    subject.next('c');

    expect(results).toEqual([1, 2, 3]);

    subject.complete();
  });

  it('should count emissions starting from a custom value', () => {
    const subject = new Subject<unknown>();
    const results: number[] = [];

    sub.subscription = subject.pipe(scanCount(10)).subscribe((value) => results.push(value));

    subject.next('a');
    subject.next('b');

    expect(results).toEqual([11, 12]);

    subject.complete();
  });
});
