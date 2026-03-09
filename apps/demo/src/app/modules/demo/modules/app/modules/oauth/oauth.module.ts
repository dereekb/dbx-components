import { NgModule } from '@angular/core';
import { UIRouterModule } from '@uirouter/angular';
import { DEMO_APP_OAUTH_STATES } from './oauth.router';
import { DemoOAuthClientsComponent } from './container/clients.component';

@NgModule({
  imports: [
    UIRouterModule.forChild({
      states: DEMO_APP_OAUTH_STATES
    }),
    // components
    DemoOAuthClientsComponent
  ]
})
export class DemoAppOAuthModule {}
