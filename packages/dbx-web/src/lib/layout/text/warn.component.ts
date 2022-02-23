import { Component, Input, OnInit } from '@angular/core';

@Component({
  selector: 'dbx-warn',
  template: `<ng-content></ng-content>`,
  host: {
    'class': 'dbx-warn'
  }
})
export class DbxWarnComponent {}
