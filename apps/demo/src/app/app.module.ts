import { NgModule } from '@angular/core';
import { provideUIRouter } from '@uirouter/angular';
import { STATES } from './app.router';

@NgModule({
  providers: [
    provideUIRouter({
      states: STATES
    })
  ]
})
export class RootAppModule {}
