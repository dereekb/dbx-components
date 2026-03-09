import { DestroyFunctionObject } from './lifecycle';

describe('DestroyFunctionObject', () => {
  it('should call the destroy function when destroy is called', () => {
    const destroyFn = vi.fn();
    const obj = new DestroyFunctionObject(destroyFn);

    obj.destroy();
    expect(destroyFn).toHaveBeenCalledTimes(1);
  });

  it('should call the previous destroy function when a new one is set', () => {
    const destroyA = vi.fn();
    const destroyB = vi.fn();
    const obj = new DestroyFunctionObject(destroyA);

    obj.setDestroyFunction(destroyB);
    expect(destroyA).toHaveBeenCalledTimes(1);
    expect(destroyB).not.toHaveBeenCalled();
  });

  it('should not have a destroy function initially if none is provided', () => {
    const obj = new DestroyFunctionObject();
    expect(obj.hasDestroyFunction).toBe(false);
  });

  it('should report hasDestroyFunction as true when one is set', () => {
    const obj = new DestroyFunctionObject(() => undefined);
    expect(obj.hasDestroyFunction).toBe(true);
  });

  it('should clear the destroy function after destroy is called', () => {
    const destroyFn = vi.fn();
    const obj = new DestroyFunctionObject(destroyFn);

    obj.destroy();
    expect(obj.hasDestroyFunction).toBe(false);
    expect(destroyFn).toHaveBeenCalledTimes(1);

    // calling destroy again should not call the function again
    obj.destroy();
    expect(destroyFn).toHaveBeenCalledTimes(1);
  });

  it('should run the example successfully', () => {
    const calls: string[] = [];
    const obj = new DestroyFunctionObject();

    obj.setDestroyFunction(() => calls.push('cleanup A'));
    obj.setDestroyFunction(() => calls.push('cleanup B')); // calls 'cleanup A'
    expect(calls).toEqual(['cleanup A']);

    obj.destroy(); // calls 'cleanup B'
    expect(calls).toEqual(['cleanup A', 'cleanup B']);
  });
});
