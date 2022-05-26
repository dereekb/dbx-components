import { of } from 'rxjs';
import { combineLatestFromArrayObsFn, combineLatestFromMapValuesObsFn } from './rxjs.map';
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
