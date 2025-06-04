import { Maybe } from '@dereekb/util';

/**
 * Can be injected to retrieve information about the global prefix configured for the app.
 */
export abstract class GlobalRoutePrefixConfig {
  readonly globalApiRoutePrefix?: Maybe<string>;
}
