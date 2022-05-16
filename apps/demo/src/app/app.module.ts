import { AppLayoutComponent } from './container/layout.component';
import { NgModule } from '@angular/core';
import { UIRouterModule } from '@uirouter/angular';
import { DemoSharedModule } from '@/shared/shared.module';
import { STATES } from './app.router';
import { CommonModule } from '@angular/common';

@NgModule({
  imports: [
    CommonModule,
    DemoSharedModule,
    UIRouterModule.forChild({
      states: STATES
    })
  ],
  declarations: [AppLayoutComponent],
})
export class RootAppModule { }
