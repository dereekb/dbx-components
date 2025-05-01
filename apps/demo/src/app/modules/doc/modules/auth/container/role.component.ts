import { AUTH_ADMIN_ROLE, AUTH_USER_ROLE } from '@dereekb/util';
import { Component } from '@angular/core';
import { DbxContentContainerDirective } from '../../../../../../../../../packages/dbx-web/src/lib/layout/content/content.container.directive';
import { DocFeatureLayoutComponent } from '../../shared/component/feature.layout.component';
import { DocFeatureExampleComponent } from '../../shared/component/feature.example.component';
import { DbxAuthHasRolesDirective } from '../../../../../../../../../packages/dbx-core/src/lib/auth/auth.role.has.directive';
import { DbxAuthHasAnyRoleDirective } from '../../../../../../../../../packages/dbx-core/src/lib/auth/auth.role.any.directive';
import { DbxAuthNotAnyRoleDirective } from '../../../../../../../../../packages/dbx-core/src/lib/auth/auth.role.not.directive';

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
