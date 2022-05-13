import { DemoAppHomeComponent } from './container/home.component';
import { DemoAppLayoutComponent } from './container/layout.component';
import { NgModule } from '@angular/core';
import { UIRouterModule } from '@uirouter/angular';
import { AppSharedModule } from '@/shared/app.shared.module';
import { DEMO_APP_STATES } from './demo.app.router';

@NgModule({
  imports: [
    AppSharedModule,
    UIRouterModule.forChild({
      states: DEMO_APP_STATES
    })
  ],
  declarations: [
    // components
    DemoAppLayoutComponent,
    DemoAppHomeComponent
  ],
})
export class DemoAppModule { }
