import { NgModule } from '@angular/core';
import { UIRouterModule } from '@uirouter/angular';
import { STATES } from './landing.router';
import { AppSharedModule } from '@/shared/app.shared.module';

@NgModule({
  imports: [
    AppSharedModule,
    UIRouterModule.forChild({
      states: STATES
    })
  ],
  declarations: [],
})
export class LandingModule { }
