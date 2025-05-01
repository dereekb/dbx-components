import { NgModule } from '@angular/core';
import { UIRouterModule } from '@uirouter/angular';
import { DemoRootSharedModule } from 'demo-components';
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
        DemoRootSharedModule,
        DbxFirebaseLoginModule,
        UIRouterModule.forChild({
            states: DEMO_AUTH_STATES
        }),
        // components
        // container
        DemoAuthLayoutComponent,
        DemoAuthAuthorizeComponent,
        DemoAuthErrorComponent,
        DemoAuthLoginComponent,
        DemoAuthLoggedOutComponent,
        DemoAuthLoginViewComponent
    ]
})
export class DemoAuthModule {}
