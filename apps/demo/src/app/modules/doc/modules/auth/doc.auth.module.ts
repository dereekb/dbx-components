import { NgModule } from '@angular/core';
import { UIRouterModule } from '@uirouter/angular';
import { DocAuthHomeComponent } from './container/home.component';

import { DocAuthLayoutComponent } from './container/layout.component';
import { STATES } from './doc.auth.router';
import { DocAuthRoleComponent } from './container/role.component';
import { DocAuthFirebaseComponent } from './container/firebase.component';
import { DbxFirebaseLoginModule } from '@dereekb/dbx-firebase';

@NgModule({
  imports: [
    DbxFirebaseLoginModule,
    UIRouterModule.forChild({
      states: STATES
    }),
    // component
    // container
    DocAuthLayoutComponent,
    DocAuthHomeComponent,
    DocAuthRoleComponent,
    DocAuthFirebaseComponent
  ]
})
export class DocAuthModule {}
