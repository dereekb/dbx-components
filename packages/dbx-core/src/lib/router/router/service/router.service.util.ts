import { Building } from '@dereekb/util';
import { SegueRefOrSegueRefRouterLink } from '../../segue';
import { DbxRouterService } from './router.service';

/**
 * Function that returns true when the configured segueRef is active.
 */
export type IsSegueRefActiveFunction = (() => boolean) & {
  readonly _segueRef: SegueRefOrSegueRefRouterLink;
  readonly _activeExactly: boolean;
};

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
 * Creates an IsSegueRefActiveFunction
 *
 * @param config
 * @returns
 */
export function isSegueRefActiveFunction(config: IsSegueRefActiveFunctionConfig): IsSegueRefActiveFunction {
  const { dbxRouterService, segueRef, activeExactly = false } = config;
  const result = (activeExactly ? () => dbxRouterService.isActiveExactly(segueRef) : () => dbxRouterService.isActive(segueRef)) as Building<IsSegueRefActiveFunction>;

  result._segueRef = segueRef;
  result._activeExactly = activeExactly;

  return result as IsSegueRefActiveFunction;
}
