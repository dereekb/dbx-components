import { type MaybeSo, type Maybe } from '@dereekb/util';
import { type INestApplication } from '@nestjs/common';

/**
 * Configuration options accepted by NestJS `setGlobalPrefix()`, with all properties made required (non-optional).
 *
 * Derived from the second parameter of {@link INestApplication.setGlobalPrefix}.
 */
export type NestGlobalRoutePrefixConfig = MaybeSo<Parameters<INestApplication['setGlobalPrefix']>[1]>;

/**
 * Route exclusion patterns from {@link NestGlobalRoutePrefixConfig}.
 *
 * Used to specify routes that should bypass the global prefix (e.g., webhook endpoints, health checks).
 */
export type NestGlobalRoutePrefixConfigExclude = NestGlobalRoutePrefixConfig['exclude'];

/**
 * Injectable configuration that exposes the global route prefix and exclusion rules for the NestJS application.
 *
 * Provided at the module level so that middleware, guards, and other components can read the prefix
 * without coupling to the bootstrap code. Used by {@link buildNestServerRootModule} to wire up the prefix
 * consistently across production and test environments.
 *
 * @see https://docs.nestjs.com/faq/global-prefix
 */
export abstract class GlobalRoutePrefixConfig implements NestGlobalRoutePrefixConfig {
  /**
   * The global API route prefix applied to all controllers (e.g., `"api"`).
   *
   * When set, all controller routes are mounted under this prefix unless explicitly excluded.
   */
  readonly globalApiRoutePrefix?: Maybe<string>;
  /**
   * Routes excluded from the global prefix, such as webhook endpoints or health checks.
   */
  readonly exclude?: NestGlobalRoutePrefixConfig['exclude'];
}
