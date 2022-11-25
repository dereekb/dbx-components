import { Component } from '@angular/core';

@Component({
  selector: 'dbx-form-description',
  template: `
    <ng-content></ng-content>
  `,
  host: {
    class: 'dbx-form-description'
  }
})
export class DbxFormDescriptionComponent {}
