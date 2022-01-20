import { Component, Input, OnInit } from '@angular/core';

@Component({
  selector: 'dbx-hint',
  template: `<p class="dbx-hint"><ng-content></ng-content></p>`,
  styleUrls: ['./text.scss']
})
export class DbNgxHintComponent {}
