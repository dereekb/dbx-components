import { RootAppLayoutComponent } from './container/layout.component';
import { NgModule } from '@angular/core';
import { UIRouterModule } from '@uirouter/angular';
import { STATES } from './app.router';
import { CommonModule } from '@angular/common';

@NgModule({
  imports: [
    CommonModule,
    UIRouterModule.forChild({
      states: STATES
    })
  ]
})
export class RootAppModule { }
