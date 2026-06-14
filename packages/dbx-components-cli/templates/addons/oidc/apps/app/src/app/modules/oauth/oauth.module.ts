import { NgModule } from '@angular/core';
import { UIRouterModule } from '@uirouter/angular';
import { APP_OAUTH_STATES } from './oauth.router';
import { APP_CODE_PREFIXOAuthLayoutComponent } from './container/layout.component';
import { APP_CODE_PREFIXOAuthLoginComponent } from './container/login.component';
import { APP_CODE_PREFIXOAuthConsentComponent } from './container/consent.component';

@NgModule({
  imports: [UIRouterModule.forChild({ states: APP_OAUTH_STATES }), APP_CODE_PREFIXOAuthLayoutComponent, APP_CODE_PREFIXOAuthLoginComponent, APP_CODE_PREFIXOAuthConsentComponent]
})
export class APP_CODE_PREFIXOAuthModule {}
