import { DemoHomeComponent } from './container/home.component';
import { DemoLayoutComponent } from './container/layout.component';
import { NgModule } from '@angular/core';
import { UIRouterModule } from '@uirouter/angular';
import { STATES } from './demo.router';
import { DemoRootSharedModule } from '@dereekb/demo-components';

@NgModule({
  imports: [
    DemoRootSharedModule,
    UIRouterModule.forChild({
      states: STATES
    })
  ],
  declarations: [DemoLayoutComponent, DemoHomeComponent]
})
export class DemoModule {}
