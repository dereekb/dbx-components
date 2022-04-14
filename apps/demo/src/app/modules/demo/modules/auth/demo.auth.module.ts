import { DemoAuthLoggedOutComponent } from './component/loggedout.component';
import { DemoAuthErrorComponent } from './component/error.component';
import { NgModule } from '@angular/core';
import { UIRouterModule } from '@uirouter/angular';
import { AppSharedModule } from '@/shared/app.shared.module';
import { DemoAuthAuthorizeComponent } from './component/authorize.component';
import { DemoAuthLayoutComponent } from './component/layout.component';
import { DemoAuthLoginButtonComponent } from './container/login.button.component';
import { DEMO_AUTH_STATES } from './demo.auth.router';
import { DemoAuthLoginComponent } from './component/login.component';
import { DemoAuthLoginViewComponent } from './container/login.view.component';

@NgModule({
  imports: [
    AppSharedModule,
    UIRouterModule.forChild({
      states: DEMO_AUTH_STATES
    })
  ],
  declarations: [
    // components
    DemoAuthLayoutComponent,
    DemoAuthAuthorizeComponent,
    DemoAuthErrorComponent,
    DemoAuthLoginComponent,
    DemoAuthLoggedOutComponent,
    // container
    DemoAuthLoginViewComponent,
    DemoAuthLoginButtonComponent
  ],
})
export class DemoAuthModule { }
