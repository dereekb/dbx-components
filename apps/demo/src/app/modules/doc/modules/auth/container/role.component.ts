import { AUTH_ADMIN_ROLE, AUTH_USER_ROLE } from '@dereekb/util';
import { Component } from '@angular/core';

@Component({
  templateUrl: './role.component.html'
})
export class DocAuthRoleComponent {
  readonly noRoles = [];
  readonly userRole = [AUTH_USER_ROLE];
  readonly adminRole = [AUTH_ADMIN_ROLE];
}
