import { Component } from '@angular/core';

@Component({
  selector: 'dbx-notice',
  template: `
    <ng-content></ng-content>
  `,
  host: {
    class: 'dbx-notice'
  }
})
export class DbxNoticeComponent {}
