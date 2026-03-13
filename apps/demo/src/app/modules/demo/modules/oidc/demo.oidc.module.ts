import { NgModule } from '@angular/core';
import { UIRouterModule } from '@uirouter/angular';
import { DEMO_OIDC_STATES } from './demo.oidc.router';
import { DemoOidcLayoutComponent } from './container/layout.component';
import { DemoOidcLoginComponent } from './container/login.component';
import { DemoOidcConsentComponent } from './container/consent.component';

@NgModule({
  imports: [
    UIRouterModule.forChild({
      states: DEMO_OIDC_STATES
    }),
    // components
    DemoOidcLayoutComponent,
    DemoOidcLoginComponent,
    DemoOidcConsentComponent
  ]
})
export class DemoOidcModule {}
