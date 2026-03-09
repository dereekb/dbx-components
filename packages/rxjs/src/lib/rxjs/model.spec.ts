import { Subject } from 'rxjs';
import { SubscriptionObject } from '../subscription';
import { distinctUntilModelIdChange, distinctUntilModelKeyChange } from './model';

describe('distinctUntilModelIdChange', () => {
  let sub: SubscriptionObject;

  beforeEach(() => {
    sub = new SubscriptionObject();
  });

  afterEach(() => {
    sub.destroy();
  });

  it('should only emit when the model id changes', () => {
    const subject = new Subject<{ id: string }>();
    const results: { id: string }[] = [];

    sub.subscription = subject.pipe(distinctUntilModelIdChange()).subscribe((value) => results.push(value));

    subject.next({ id: 'a' });
    subject.next({ id: 'a' }); // same id
    subject.next({ id: 'b' }); // different id

    expect(results.length).toBe(2);
    expect(results[0].id).toBe('a');
    expect(results[1].id).toBe('b');

    subject.complete();
  });
});

describe('distinctUntilModelKeyChange', () => {
  let sub: SubscriptionObject;

  beforeEach(() => {
    sub = new SubscriptionObject();
  });

  afterEach(() => {
    sub.destroy();
  });

  it('should only emit when the model key changes', () => {
    const subject = new Subject<{ key: string }>();
    const results: { key: string }[] = [];

    sub.subscription = subject.pipe(distinctUntilModelKeyChange()).subscribe((value) => results.push(value));

    subject.next({ key: 'x' });
    subject.next({ key: 'x' }); // same key
    subject.next({ key: 'y' }); // different key

    expect(results.length).toBe(2);
    expect(results[0].key).toBe('x');
    expect(results[1].key).toBe('y');

    subject.complete();
  });
});
