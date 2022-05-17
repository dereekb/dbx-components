import { AppHomeComponent } from './container/home.component';
import { AppLayoutComponent } from './container/layout.component';
import { NgModule } from '@angular/core';
import { UIRouterModule } from '@uirouter/angular';
import { STATES } from './app.router';
import { APP_CODE_PREFIXRootSharedModule } from 'ANGULAR_COMPONENTS_NAME';

@NgModule({
  imports: [
    APP_CODE_PREFIXRootSharedModule,
    UIRouterModule.forChild({
      states: STATES
    })
  ],
  declarations: [
    AppLayoutComponent,
    AppHomeComponent,
  ],
})
export class AppModule { }
