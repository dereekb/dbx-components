import { MaybeSo, WebsitePath, type Maybe } from '@dereekb/util';
import { INestApplication } from '@nestjs/common';

export type NestGlobalRoutePrefixConfig = MaybeSo<Parameters<INestApplication['setGlobalPrefix']>[1]>;

export type NestGlobalRoutePrefixConfigExclude = NestGlobalRoutePrefixConfig['exclude'];

/**
 * Can be injected to retrieve information about the global prefix configured for the app.
 *
 * @see https://docs.nestjs.com/faq/global-prefix
 */
export abstract class GlobalRoutePrefixConfig implements NestGlobalRoutePrefixConfig {
  readonly globalApiRoutePrefix?: Maybe<string>;
  readonly exclude?: NestGlobalRoutePrefixConfig['exclude'];
}
