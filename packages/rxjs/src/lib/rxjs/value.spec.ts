import { type Maybe } from '@dereekb/util';
import { of, type Observable } from 'rxjs';
import { switchMapToDefault } from './value';

describe('switchMapToDefault()', () => {
  it('should pipe values from the default input value if it recieves null or undefined', (done) => {
    const obs: Observable<Maybe<number>> = of(null);
    const defaultValue = 1;

    const result = obs.pipe(switchMapToDefault(defaultValue));

    result.subscribe((value) => {
      expect(value).toBe(defaultValue);
      done();
    });
  });

  it('should pipe values from the default input obs if it recieves null or undefined', (done) => {
    const obs: Observable<Maybe<number>> = of(null);
    const defaultValue = 1;
    const defaultValueObs = of(defaultValue);

    const result = obs.pipe(switchMapToDefault(defaultValueObs));

    result.subscribe((value) => {
      expect(value).toBe(defaultValue);
      done();
    });
  });
});
