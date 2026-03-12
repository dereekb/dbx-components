import { NgModule } from '@angular/core';
import { UIRouterModule } from '@uirouter/angular';
import { DEMO_APP_OAUTH_STATES } from './oauth.router';
import { DemoAppOAuthLayoutComponent } from './container/layout.component';
import { DemoAppOAuthClientListPageComponent } from './container/list.component';
import { DemoAppOAuthClientListPageRightComponent } from './container/list.right.component';
import { DemoAppOAuthClientCreatePageComponent } from './container/list.create.component';

@NgModule({
  imports: [
    UIRouterModule.forChild({
      states: DEMO_APP_OAUTH_STATES
    }),
    // components
    DemoAppOAuthLayoutComponent,
    DemoAppOAuthClientListPageComponent,
    DemoAppOAuthClientListPageRightComponent,
    DemoAppOAuthClientCreatePageComponent
  ]
})
export class DemoAppOAuthModule {}
