import { RootAppLayoutComponent } from './container/layout.component';
import { NgModule } from '@angular/core';
import { UIRouterModule } from '@uirouter/angular';
import { APP_CODE_PREFIXSharedModule } from '@/shared/shared.module';
import { STATES } from './app.router';
import { CommonModule } from '@angular/common';

@NgModule({
  imports: [
    CommonModule,
    APP_CODE_PREFIXSharedModule,
    UIRouterModule.forChild({
      states: STATES
    })
  ],
  declarations: [RootAppLayoutComponent],
})
export class RootAppModule { }
