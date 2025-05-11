import { type Getter } from './getter';
import { mapGetter, mapGetterFactory } from './getter.map';

describe('mapGetterFactory()', () => {
  it('should return a function that takes a getter and returns a new getter', () => {
    const mapFn = (x: number) => x * 2;
    const factory = mapGetterFactory(mapFn);
    expect(typeof factory).toBe('function');

    const initialValue = 5;
    const inputGetter: Getter<number> = () => initialValue;
    const mappedGetter = factory(inputGetter);

    expect(typeof mappedGetter).toBe('function');
    expect(mappedGetter()).toBe(mapFn(initialValue));
  });

  it('the returned getter should call the input getter and map function on each invocation', () => {
    let i = 0;
    const inputGetter: Getter<number> = () => {
      i += 1;
      return i;
    };
    const mapFn = jest.fn((x: number) => x.toString());

    const factory = mapGetterFactory(mapFn);
    const mappedGetter = factory(inputGetter);

    expect(mappedGetter()).toBe('1');
    expect(mapFn).toHaveBeenCalledWith(1);
    expect(i).toBe(1);

    expect(mappedGetter()).toBe('2');
    expect(mapFn).toHaveBeenCalledWith(2);
    expect(i).toBe(2);
  });
});

describe('mapGetter()', () => {
  it('should return a getter that maps the value of the input getter', () => {
    const initialValue = 10;
    const inputGetter: Getter<number> = () => initialValue;
    const mapFn = (x: number) => `value: ${x}`;

    const mappedGetter = mapGetter(inputGetter, mapFn);
    expect(typeof mappedGetter).toBe('function');
    expect(mappedGetter()).toBe(mapFn(initialValue));
  });

  it('the returned getter should call the input getter and map function on each invocation', () => {
    let i = 0;
    const inputGetter: Getter<number> = () => {
      i += 1;
      return i;
    };
    const mapFn = jest.fn((x: number) => x * 10);

    const mappedGetter = mapGetter(inputGetter, mapFn);

    expect(mappedGetter()).toBe(10);
    expect(mapFn).toHaveBeenCalledWith(1);
    expect(i).toBe(1);

    expect(mappedGetter()).toBe(20);
    expect(mapFn).toHaveBeenCalledWith(2);
    expect(i).toBe(2);
  });
});
