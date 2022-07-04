import { Maybe } from '../value/maybe.type';

export type PromiseCallback = (err?: Maybe<Error>) => void;
export type UsePromiseCallback = (cb: PromiseCallback) => void;

export async function useCallback(use: UsePromiseCallback): Promise<void> {
  return new Promise((resolve, reject) => {
    const callback = (err?: Maybe<Error>) => {
      if (err != null) {
        reject(err);
      } else {
        resolve();
      }
    };

    use(callback);
  });
}
