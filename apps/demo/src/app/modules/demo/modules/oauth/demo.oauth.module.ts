import { NgModule } from '@angular/core';
import { UIRouterModule } from '@uirouter/angular';
import { DEMO_OAUTH_STATES } from './demo.oauth.router';
import { DemoAppOAuthLayoutComponent } from './container/layout.component';
import { DemoOAuthLoginComponent } from './container/login.component';
import { DemoOAuthConsentComponent } from './container/consent.component';

@NgModule({
  imports: [
    UIRouterModule.forChild({
      states: DEMO_OAUTH_STATES
    }),
    // components
    DemoAppOAuthLayoutComponent,
    DemoOAuthLoginComponent,
    DemoOAuthConsentComponent
  ]
})
export class DemoOAuthModule {}
