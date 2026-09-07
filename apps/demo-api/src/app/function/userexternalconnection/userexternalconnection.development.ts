import { type DemoDevelopmentBackfillUserExternalConnectionParams, type DemoDevelopmentBackfillUserExternalConnectionResult } from 'demo-firebase';
import { type DemoDevelopmentFunction } from '../function.context';

/**
 * Recomputes every UserExternalConnection's derived `ec` array.
 *
 * Exposed through developer functions rather than a user-reachable route because it walks the whole
 * collection: it is an operator action, run once after enabling a uniqueness policy or after adding a
 * source that contributes to `ec`. Idempotent, and `dryRun` reports what it would change.
 *
 * @param request - The development function request.
 * @returns How many documents were visited and how many were rewritten.
 */
export const backfillUserExternalConnectionExternalAccountKeysDevelopmentFunction: DemoDevelopmentFunction<DemoDevelopmentBackfillUserExternalConnectionParams, DemoDevelopmentBackfillUserExternalConnectionResult> = async (request) => {
  const { nest, data } = request;
  return nest.userExternalConnectionActions.backfillUserExternalConnectionExternalAccountKeys(data);
};

/**
 * Creates a login link for every pre-existing connection whose provider is enabled for sign-in.
 *
 * Run this once after adopting login links, so a user who connected a sign-in provider before they
 * existed sees it as linked rather than being asked to link it again.
 *
 * @param request - The development function request.
 * @returns How many documents were visited and how many gained a login link.
 */
export const backfillUserExternalConnectionLoginsDevelopmentFunction: DemoDevelopmentFunction<DemoDevelopmentBackfillUserExternalConnectionParams, DemoDevelopmentBackfillUserExternalConnectionResult> = async (request) => {
  const { nest, data } = request;
  return nest.userExternalConnectionActions.backfillUserExternalConnectionLogins(data);
};
