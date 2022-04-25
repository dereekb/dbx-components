import { DemoProfileViewComponent } from './container/profile.component';
import { DemoProfileLayoutComponent } from './container/layout.component';
import { NgModule } from '@angular/core';
import { UIRouterModule } from '@uirouter/angular';
import { STATES } from './profile.router';
import { AppSharedModule } from '@/shared/app.shared.module';

@NgModule({
  imports: [
    AppSharedModule,
    UIRouterModule.forChild({
      states: STATES
    })
  ],
  declarations: [
    DemoProfileLayoutComponent,
    DemoProfileViewComponent
  ],
})
export class DemoProfileModule { }
