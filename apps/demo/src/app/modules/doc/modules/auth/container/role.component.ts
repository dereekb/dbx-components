import { AUTH_ADMIN_ROLE, AUTH_USER_ROLE } from '@dereekb/util';
import { Component } from '@angular/core';
import { DbxContentContainerDirective } from '@dereekb/dbx-web';
import { DocFeatureLayoutComponent } from '../../shared/component/feature.layout.component';
import { DocFeatureExampleComponent } from '../../shared/component/feature.example.component';
import { DbxAuthHasRolesDirective } from '@dereekb/dbx-core';
import { DbxAuthHasAnyRoleDirective } from '@dereekb/dbx-core';
import { DbxAuthNotAnyRoleDirective } from '@dereekb/dbx-core';

@Component({
  templateUrl: './role.component.html',
  standalone: true,
  imports: [DbxContentContainerDirective, DocFeatureLayoutComponent, DocFeatureExampleComponent, DbxAuthHasRolesDirective, DbxAuthHasAnyRoleDirective, DbxAuthNotAnyRoleDirective]
})
export class DocAuthRoleComponent {
  readonly noRoles = [];
  readonly userRole = [AUTH_USER_ROLE];
  readonly adminRole = [AUTH_ADMIN_ROLE];
}
