import { Component, Input, OnInit } from '@angular/core';

@Component({
  selector: 'dbx-notice',
  template: `<p class="dbx-notice"><ng-content></ng-content></p>`,
  styleUrls: ['./text.scss']
})
export class DbNgxNoticeComponent {

  @Input()
  text: string;

}
