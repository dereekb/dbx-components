import { of } from 'rxjs';
import { workFactory } from './work.factory';
import { callbackTest } from '@dereekb/util/test';

describe('workFactory', () => {
  it(
    'should create a WorkInstance that tracks work from an observable',
    callbackTest((done) => {
      const delegate = {
        startWorking: vi.fn(),
        success: vi.fn(),
        reject: vi.fn()
      };

      const factory = workFactory({
        work: (value: number) => of(`result: ${value}`),
        delegate
      });

      const instance = factory(42);

      expect(instance).toBeDefined();
      expect(instance!.value).toBe(42);

      instance!.isComplete$.subscribe((isComplete) => {
        if (isComplete) {
          expect(delegate.success).toHaveBeenCalledWith('result: 42');
          done();
        }
      });
    })
  );

  it('should catch errors thrown by the work function and call reject', () => {
    const delegate = {
      startWorking: vi.fn(),
      success: vi.fn(),
      reject: vi.fn()
    };

    const factory = workFactory({
      work: () => {
        throw new Error('boom');
      },
      delegate
    });

    // workFactory returns undefined when the work function throws
    const instance = factory(1);
    expect(instance).toBeUndefined();
    expect(delegate.reject).toHaveBeenCalled();
  });
});
