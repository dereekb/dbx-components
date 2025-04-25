import { NgModule } from '@angular/core';
import { UIRouterModule } from '@uirouter/angular';
import { STATES } from './app.router';

@NgModule({
  imports: [
    UIRouterModule.forChild({
      states: STATES
    })
  ]
})
export class AppModule { }
