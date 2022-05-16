
import { NgModule } from '@angular/core';
import { UIRouterModule } from '@uirouter/angular';
import { DemoSharedModule } from '@/shared/shared.module';
import { DemoAuthAuthorizeComponent } from './container/authorize.component';
import { DemoAuthLayoutComponent } from './container/layout.component';
import { DemoAuthLoggedOutComponent } from './container/loggedout.component';
import { DemoAuthErrorComponent } from './container/error.component';
import { DEMO_AUTH_STATES } from './demo.auth.router';
import { DemoAuthLoginComponent } from './container/login.component';
import { DemoAuthLoginViewComponent } from './container/login.view.component';
import { DbxFirebaseLoginModule } from '@dereekb/dbx-firebase';

@NgModule({
  imports: [
    DemoSharedModule,
    DbxFirebaseLoginModule,
    UIRouterModule.forChild({
      states: DEMO_AUTH_STATES
    })
  ],
  declarations: [
    // components
    // container
    DemoAuthLayoutComponent,
    DemoAuthAuthorizeComponent,
    DemoAuthErrorComponent,
    DemoAuthLoginComponent,
    DemoAuthLoggedOutComponent,
    DemoAuthLoginViewComponent
  ],
})
export class DemoAuthModule { }
