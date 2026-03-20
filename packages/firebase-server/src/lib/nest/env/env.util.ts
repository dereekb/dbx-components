import { type AsyncDecisionFunction } from '@dereekb/util';
import { FirebaseServerEnvService } from '../../env/env.service';
import { type NestAppPromiseGetter } from '../app';

/**
 * Creates an async decision function that resolves to `true` if the NestJS app is running in production.
 *
 * Useful for conditionally enabling production-only Cloud Functions (e.g., scheduled tasks).
 *
 * @param nest - getter for the NestJS application context promise.
 * @returns An async decision function that resolves to `true` in production.
 *
 * @example
 * ```typescript
 * const isProduction = nestAppIsProductionEnvironment(nestAppGetter);
 * if (await isProduction()) { ... }
 * ```
 */
export function nestAppIsProductionEnvironment(nest: NestAppPromiseGetter): AsyncDecisionFunction<void> {
  return () => nest().then((x) => x.get(FirebaseServerEnvService).isProduction);
}

/**
 * Creates an async decision function that resolves to `true` if the development scheduler is enabled.
 *
 * The development scheduler is enabled in non-production, non-testing environments.
 *
 * @param nest - getter for the NestJS application context promise.
 * @returns An async decision function that resolves to `true` when the development scheduler is enabled.
 */
export function nestAppHasDevelopmentSchedulerEnabled(nest: NestAppPromiseGetter): AsyncDecisionFunction<void> {
  return () => nest().then((x) => x.get(FirebaseServerEnvService).developmentSchedulerEnabled);
}
