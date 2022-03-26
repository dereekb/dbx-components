import { NgModule } from '@angular/core';
import { UIRouterModule } from '@uirouter/angular';
import { DocAuthHomeComponent } from './container/home.component';
import { DocSharedModule } from '../shared/doc.shared.module';
import { DocAuthLayoutComponent } from './container/layout.component';
import { STATES } from './doc.auth.router';
import { DocAuthRoleComponent } from './container/role.component';

@NgModule({
  imports: [
    DocSharedModule,
    UIRouterModule.forChild({
      states: STATES
    })
  ],
  declarations: [
    // component
    // container
    DocAuthLayoutComponent,
    DocAuthHomeComponent,
    DocAuthRoleComponent
  ],
})
export class DocAuthModule { }
