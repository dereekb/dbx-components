import { chainMapSameFunctions } from './map';

describe('chainMapSameFunctions', () => {
  it('should chain all the input functions together.', () => {
    let aCalled = false;
    let bCalled = false;
    let cCalled = false;
    let dCalled = false;

    const fnChain = chainMapSameFunctions([
      (x) => {
        aCalled = true;
        return x;
      },
      (x) => {
        bCalled = true;
        return x;
      },
      (x) => {
        cCalled = true;
        return x;
      },
      (x) => {
        dCalled = true;
        return x;
      }
    ]);

    const value = 'aaaab';
    const result = fnChain(value);
    expect(result).toBe(value);

    expect(aCalled).toBe(true);
    expect(bCalled).toBe(true);
    expect(cCalled).toBe(true);
    expect(dCalled).toBe(true);
  });
});
