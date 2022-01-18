import { Component, Input, OnInit } from '@angular/core';

@Component({
  selector: 'dbx-warn',
  template: `<p class="dbx-warn"><ng-content></ng-content></p>`,
  styleUrls: ['./text.scss']
})
export class DbNgxWarnComponent {}
