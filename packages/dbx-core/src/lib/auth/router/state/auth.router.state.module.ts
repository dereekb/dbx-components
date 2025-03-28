import { ModuleWithProviders, NgModule } from '@angular/core';
import { ArrayOrValue } from '@dereekb/util';
import { EffectsModule } from '@ngrx/effects';
import { DbxAppContextState } from '../../../context';
import { DbxAppAuthRouterEffects, DBX_APP_AUTH_ROUTER_EFFECTS_TOKEN } from './effect/auth.router.state.effect';

export interface DbxAppAuthRouterStateModuleConfig {
  readonly activeRoutesToApplyEffects: ArrayOrValue<DbxAppContextState>;
}

/**
 * @deprecated Use provideDbxAppAuthRouterState() instead.
 */
@NgModule({
  imports: [],
  declarations: [],
  exports: []
})
export class DbxAppAuthRouterStateModule {
  static forRoot(config: DbxAppAuthRouterStateModuleConfig): ModuleWithProviders<DbxAppAuthRouterStateModule> {
    return {
      ngModule: DbxAppAuthRouterStateModule,
      providers: [
        {
          provide: DBX_APP_AUTH_ROUTER_EFFECTS_TOKEN,
          useValue: config.activeRoutesToApplyEffects
        }
      ]
    };
  }
}
