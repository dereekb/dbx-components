import { NgModule } from '@angular/core';
import { UIRouterModule } from '@uirouter/angular';
import { STATES } from './landing.router';
import { DemoSharedModule } from '@/shared/shared.module';
import { LandingLayoutComponent } from './container/layout.component';

@NgModule({
  imports: [
    DemoSharedModule,
    UIRouterModule.forChild({
      states: STATES
    })
  ],
  declarations: [
    LandingLayoutComponent
  ],
})
export class LandingModule { }
