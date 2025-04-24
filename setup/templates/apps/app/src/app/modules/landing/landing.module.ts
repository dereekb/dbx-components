import { NgModule } from '@angular/core';
import { UIRouterModule } from '@uirouter/angular';
import { STATES } from './landing.router';

@NgModule({
  imports: [
    UIRouterModule.forChild({
      states: STATES
    })
  ]
})
export class LandingModule { }
