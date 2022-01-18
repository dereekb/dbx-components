import { Component, Input, OnInit } from '@angular/core';

@Component({
  selector: 'dbx-ok',
  template: `<p class="dbx-ok"><ng-content></ng-content></p>`,
  styleUrls: ['./text.scss']
})
export class DbNgxOkComponent {

  @Input()
  text: string;

}
