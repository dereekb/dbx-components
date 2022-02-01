import { DocTextLayoutComponent } from './container/layout.component';
import { NgModule } from '@angular/core';
import { UIRouterModule } from '@uirouter/angular';
import { STATES } from './doc.text.router';
import { AppSharedModule } from '@/shared/app.shared.module';

@NgModule({
  imports: [
    AppSharedModule,
    UIRouterModule.forChild({
      states: STATES
    })
  ],
  declarations: [
    DocTextLayoutComponent
  ],
})
export class DocTextModule { }
