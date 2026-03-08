/**
 * Returns a Promise that resolves after the specified number of milliseconds.
 * Optionally resolves with the provided value.
 *
 * @param ms - The number of milliseconds to wait before resolving.
 * @param value - An optional value to resolve the Promise with.
 * @returns A Promise that resolves after the specified delay.
 */
export async function waitForMs(ms: number): Promise<void>;
export async function waitForMs<T>(ms: number, value?: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value as T), ms));
}
