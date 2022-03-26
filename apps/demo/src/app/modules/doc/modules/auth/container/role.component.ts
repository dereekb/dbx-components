import { AUTH_APP_USER_ROLE } from '@dereekb/dbx-core';
import { Component } from '@angular/core';

@Component({
  templateUrl: './role.component.html'
})
export class DocAuthRoleComponent {

  readonly noRoles = [];
  readonly userRole = [AUTH_APP_USER_ROLE];

}
