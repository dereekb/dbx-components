import { NgModule } from '@angular/core';
import { UIRouterModule } from '@uirouter/angular';
import { DocActionHomeComponent } from './container/home.component';
import { DocSharedModule } from '../shared/doc.shared.module';
import { DocActionLayoutComponent } from './container/layout.component';
import { STATES } from './doc.action.router';
import { DocActionContextComponent } from './container/context.component';
import { DocActionExampleToolsComponent } from './component/action.example.tool.component';

@NgModule({
  imports: [
    DocSharedModule,
    UIRouterModule.forChild({
      states: STATES
    })
  ],
  declarations: [
    // component
    DocActionExampleToolsComponent,
    // container
    DocActionContextComponent,
    DocActionLayoutComponent,
    DocActionHomeComponent
  ],
})
export class DocActionModule { }
