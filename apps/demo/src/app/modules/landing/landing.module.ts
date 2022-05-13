import { NgModule } from '@angular/core';
import { UIRouterModule } from '@uirouter/angular';
import { STATES } from './landing.router';
import { AppSharedModule } from '@/shared/app.shared.module';
import { LandingLayoutComponent } from './container/layout.component';

@NgModule({
  imports: [
    AppSharedModule,
    UIRouterModule.forChild({
      states: STATES
    })
  ],
  declarations: [
    LandingLayoutComponent
  ],
})
export class LandingModule { }
