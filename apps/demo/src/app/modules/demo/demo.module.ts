import { DemoHomeComponent } from './container/home.component';
import { DemoLayoutComponent } from './container/layout.component';
import { NgModule } from '@angular/core';
import { UIRouterModule } from '@uirouter/angular';
import { STATES } from './demo.router';
import { AppSharedModule } from '@/shared/app.shared.module';

@NgModule({
  imports: [
    AppSharedModule,
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
