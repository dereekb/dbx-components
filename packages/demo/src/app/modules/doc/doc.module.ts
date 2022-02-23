import { DocLayoutComponent } from './container/layout.component';
import { NgModule } from '@angular/core';
import { UIRouterModule } from '@uirouter/angular';
import { STATES } from './doc.router';
import { AppSharedModule } from '@/shared/app.shared.module';

@NgModule({
  imports: [
    AppSharedModule,
    UIRouterModule.forChild({
      states: STATES
    })
  ],
  declarations: [
    DocLayoutComponent
  ],
})
export class DocModule { }
