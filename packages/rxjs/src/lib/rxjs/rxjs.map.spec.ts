import { first, of, Subject, timeout } from 'rxjs';
import { combineLatestFromArrayObsFn, combineLatestFromMapValuesObsFn, combineLatestFromObject } from './rxjs.map';
import { SubscriptionObject } from '../subscription';

describe('rxjs.map', () => {
  let sub: SubscriptionObject;

  beforeEach(() => {
    sub = new SubscriptionObject();
  });

  afterEach(() => {
    sub.destroy();
  });

  describe('combineLatestFromMapValuesObsFn()', () => {
    describe('function', () => {
      it('should combine the latests values of the map', (done) => {
        const obsForMap = combineLatestFromMapValuesObsFn((value: number) => of(String(value)));

        const map = new Map<string, number>();

        map.set('1', 1);
        map.set('2', 2);
        map.set('3', 3);

        const obs = obsForMap(map);

        sub.subscription = obs.subscribe((values) => {
          expect(values[0]).toBe('1');
          expect(values[1]).toBe('2');
          expect(values[2]).toBe('3');
          done();
        });
      });
    });
  });

  describe('combineLatestFromArrayObsFn()', () => {
    it('should combine the latest value from all the passed observables into a single value.', (done) => {
      const mapToObs = (value: number) => of(String(value));

      const obsForValues = combineLatestFromArrayObsFn(mapToObs);

      const obs = obsForValues([1, 2, 3]);

      sub.subscription = obs.subscribe((values) => {
        expect(values[0]).toBe('1');
        expect(values[1]).toBe('2');
        expect(values[2]).toBe('3');
        done();
      });
    });
  });
});

describe('combineLatestFromObject()', () => {
  it('should handle null values.', (done) => {
    const obs = combineLatestFromObject({
      a: undefined,
      b: null
    });

    obs.pipe(first()).subscribe((y) => {
      expect(y.a).toBe(undefined);
      expect(y.b).toBe(null);
      done();
    });
  });

  it('should merge all the latest values into a single object.', (done) => {
    const obs = combineLatestFromObject({
      a: true,
      b: of('string'),
      c: of(1)
    });

    obs.pipe(first()).subscribe((y) => {
      expect(y.a).toBe(true);
      expect(y.b).toBe('string');
      expect(y.c).toBe(1);
      done();
    });
  });

  it('should wait for a value from each observable to be emitted.', (done) => {
    const subject = new Subject<number>();

    const obs = combineLatestFromObject({
      a: true,
      c: subject
    });

    obs.pipe(timeout({ first: 200, with: () => of(0) }), first()).subscribe((filter) => {
      expect(filter).toBe(0);
      subject.complete();
      done();
    });
  });
});
