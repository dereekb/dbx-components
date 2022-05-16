import { DemoHomeComponent } from './container/home.component';
import { DemoLayoutComponent } from './container/layout.component';
import { NgModule } from '@angular/core';
import { UIRouterModule } from '@uirouter/angular';
import { STATES } from './app.router';
import { DemoSharedModule } from '@/shared/shared.module';

@NgModule({
  imports: [
    DemoSharedModule,
    UIRouterModule.forChild({
      states: STATES
    })
  ],
  declarations: [
    DemoLayoutComponent,
    DemoHomeComponent,
  ],
})
export class DemoModule { }
