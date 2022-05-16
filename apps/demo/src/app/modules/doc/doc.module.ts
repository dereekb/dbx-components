import { DocHomeComponent } from './container/home.component';
import { DocLayoutComponent } from './container/layout.component';
import { NgModule } from '@angular/core';
import { UIRouterModule } from '@uirouter/angular';
import { STATES } from './doc.router';
import { DemoSharedModule } from '@/shared/shared.module';
import { DocSharedModule } from './modules/shared/doc.shared.module';

@NgModule({
  imports: [
    DemoSharedModule,
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
