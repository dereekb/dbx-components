/**
 * Waits a certain number of ms before resolving the promise.
 *
 * @param ms
 */
export async function waitForMs(ms: number): Promise<void>;
export async function waitForMs<T>(ms: number, value?: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value as T), ms));
}
