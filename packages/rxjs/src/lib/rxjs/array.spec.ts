import { distinctUntilArrayLengthChanges } from './array';
import { BehaviorSubject } from 'rxjs';

describe('distinctUntilArrayLengthChanges()', () => {

  it('should not emit values while the length does not change.', (done) => {

    const value: [] = [];

    const subject = new BehaviorSubject<[]>(value);
    const obs = subject.pipe(distinctUntilArrayLengthChanges());

    let emissions = 0;

    // First emission because of behavior subject.
    const sub = obs.subscribe((x) => {
      emissions += 1;
      expect(x.length).toBe(0);
    });

    // Skipped
    subject.next(value);
    subject.next(value);
    subject.next(value);

    sub.unsubscribe();
    expect(emissions).toBe(1);

    done();
  });

  it('should emit values if the same array is pushed and the length changes.', (done) => {

    const value: number[] = [];

    const subject = new BehaviorSubject<number[]>(value);
    const obs = subject.pipe(distinctUntilArrayLengthChanges());

    let emissions = 0;

    // First emission because of behavior subject.
    const sub = obs.subscribe((x) => {
      emissions += 1;
    });

    // Skipped
    subject.next(value);
    subject.next(value);
    subject.next(value);

    expect(emissions).toBe(1);

    value.push(1);

    expect(emissions).toBe(1);  // No change until subject is pushed

    subject.next(value);

    expect(emissions).toBe(2);  // No change until subject is pushed

    sub.unsubscribe();
    done();
  });

  it('should use the mapping function to return the target array.', (done) => {

    const value: {
      x: number[]
    } = {
      x: []
    };

    const subject = new BehaviorSubject<{ x: number[] }>(value);
    const obs = subject.pipe(distinctUntilArrayLengthChanges((x) => x.x));

    let emissions = 0;

    // First emission because of behavior subject.
    const sub = obs.subscribe((x) => {
      emissions += 1;
      expect(x.x.length).toBe(0);
    });

    // Skipped
    subject.next(value);
    subject.next(value);
    subject.next(value);

    sub.unsubscribe();
    expect(emissions).toBe(1);

    done();
  });

});
