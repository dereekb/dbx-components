import { Subject } from 'rxjs';
import { SubscriptionObject } from '../subscription';
import { distinctUntilKeysChange, distinctUntilObjectKeyChange } from './key';

describe('distinctUntilKeysChange', () => {
  let sub: SubscriptionObject;

  beforeEach(() => {
    sub = new SubscriptionObject();
  });

  afterEach(() => {
    sub.destroy();
  });

  it('should emit when the set of keys changes', () => {
    const subject = new Subject<{ id: number }[]>();
    const results: { id: number }[][] = [];

    sub.subscription = subject.pipe(distinctUntilKeysChange((x) => x.id)).subscribe((value) => results.push(value));

    subject.next([{ id: 1 }, { id: 2 }]);
    subject.next([{ id: 1 }, { id: 2 }]); // same keys, should not emit
    subject.next([{ id: 1 }, { id: 3 }]); // different keys, should emit

    expect(results.length).toBe(2);

    subject.complete();
  });
});

describe('distinctUntilObjectKeyChange', () => {
  let sub: SubscriptionObject;

  beforeEach(() => {
    sub = new SubscriptionObject();
  });

  afterEach(() => {
    sub.destroy();
  });

  it('should emit when the extracted key changes', () => {
    const subject = new Subject<{ id: number; name: string }>();
    const results: { id: number; name: string }[] = [];

    sub.subscription = subject.pipe(distinctUntilObjectKeyChange((x) => x.id)).subscribe((value) => results.push(value));

    subject.next({ id: 1, name: 'a' });
    subject.next({ id: 1, name: 'b' }); // same id, should not emit
    subject.next({ id: 2, name: 'c' }); // different id, should emit

    expect(results.length).toBe(2);
    expect(results[0].name).toBe('a');
    expect(results[1].name).toBe('c');

    subject.complete();
  });
});
