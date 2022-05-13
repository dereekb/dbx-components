import { DocHomeComponent } from './container/home.component';
import { DocLayoutComponent } from './container/layout.component';
import { NgModule } from '@angular/core';
import { UIRouterModule } from '@uirouter/angular';
import { STATES } from './doc.router';
import { AppSharedModule } from '@/shared/app.shared.module';
import { DocSharedModule } from './modules/shared/doc.shared.module';

@NgModule({
  imports: [
    AppSharedModule,
    DocSharedModule,
    UIRouterModule.forChild({
      states: STATES
    })
  ],
  declarations: [
    DocHomeComponent,
    DocLayoutComponent
  ],
})
export class DocModule { }
