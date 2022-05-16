import { NgModule } from '@angular/core';
import { UIRouterModule } from '@uirouter/angular';
import { STATES } from './landing.router';
import { APP_CODE_PREFIXRootSharedModule } from 'ANGULAR_COMPONENTS_NAME';
import { LandingLayoutComponent } from './container/layout.component';

@NgModule({
  imports: [
    APP_CODE_PREFIXRootSharedModule,
    UIRouterModule.forChild({
      states: STATES
    })
  ],
  declarations: [
    LandingLayoutComponent
  ],
})
export class LandingModule { }
