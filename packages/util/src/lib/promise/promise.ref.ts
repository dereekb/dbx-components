

export interface PromiseFullRef<O = any> {
  readonly promise: Promise<O>;
  readonly resolve: (value: O | PromiseLike<O>) => void
  readonly reject: (reason?: any) => void
}

export type PromiseExecutor<O> = (resolve: (value: O | PromiseLike<O>) => void, reject: (reason?: any) => void) => void;


let i = 0;

/**
 * Creates a new promise and returns the full ref for it.
 */
export function makePromiseFullRef<O>(executor: PromiseExecutor<O>): PromiseFullRef<O> {
  const ref: any = {} as any;

  ref.promise = new Promise((resolve, reject) => {
    ref.resolve = resolve;
    ref.reject = reject;
    
    executor(resolve, reject);
  });

  ref.number = i += 1;

  return ref;
}
