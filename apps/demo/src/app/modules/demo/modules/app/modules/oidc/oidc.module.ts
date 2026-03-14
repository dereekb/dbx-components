import { NgModule } from '@angular/core';
import { UIRouterModule } from '@uirouter/angular';
import { DEMO_APP_OIDC_STATES } from './oidc.router';
import { DemoAppOidcLayoutComponent } from './container/layout.component';
import { DemoAppOidcClientListPageComponent } from './container/list.component';
import { DemoAppOidcClientListPageRightComponent } from './container/list.right.component';
import { DemoAppOidcClientCreatePageComponent } from './container/list.create.component';

@NgModule({
  imports: [
    UIRouterModule.forChild({
      states: DEMO_APP_OIDC_STATES
    }),
    // components
    DemoAppOidcLayoutComponent,
    DemoAppOidcClientListPageComponent,
    DemoAppOidcClientListPageRightComponent,
    DemoAppOidcClientCreatePageComponent
  ]
})
export class DemoAppOidcModule {}
