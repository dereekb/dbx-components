import { type Building } from '@dereekb/util';
import { type SegueRefOrSegueRefRouterLink } from '../../segue';
import { type DbxRouterService } from './router.service';

/**
 * A callable function that returns `true` when the configured segue ref is currently active in the router.
 *
 * Also exposes the underlying segue ref and match mode as readonly properties for introspection.
 *
 * @see {@link isSegueRefActiveFunction} for creating instances
 */
export type IsSegueRefActiveFunction = (() => boolean) & {
  readonly _segueRef: SegueRefOrSegueRefRouterLink;
  readonly _activeExactly: boolean;
};

/**
 * Configuration for creating an {@link IsSegueRefActiveFunction}.
 *
 * @see {@link isSegueRefActiveFunction}
 */
export interface IsSegueRefActiveFunctionConfig {
  readonly dbxRouterService: DbxRouterService;
  readonly segueRef: SegueRefOrSegueRefRouterLink;
  /**
   * Whether or not to match the route exactly.
   *
   * False by default.
   */
  readonly activeExactly?: boolean;
}

/**
 * Creates an {@link IsSegueRefActiveFunction} from the given configuration.
 *
 * The returned function checks whether the configured segue ref is active in the router each time it is called.
 * When `activeExactly` is `true`, uses `isActiveExactly`; otherwise uses `isActive`.
 *
 * @param config - The configuration containing the router service, segue ref, and match mode.
 * @returns A callable function that returns `true` when the route is active.
 *
 * @see {@link IsSegueRefActiveFunctionConfig}
 */
export function isSegueRefActiveFunction(config: IsSegueRefActiveFunctionConfig): IsSegueRefActiveFunction {
  const { dbxRouterService, segueRef, activeExactly = false } = config;
  const result = (activeExactly ? () => dbxRouterService.isActiveExactly(segueRef) : () => dbxRouterService.isActive(segueRef)) as Building<IsSegueRefActiveFunction>;

  result._segueRef = segueRef;
  result._activeExactly = activeExactly;

  return result as IsSegueRefActiveFunction;
}
