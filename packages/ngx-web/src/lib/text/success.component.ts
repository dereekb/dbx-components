import { Component, Input, OnInit } from '@angular/core';

@Component({
  selector: 'dbx-success',
  template: `<p class="dbx-success"><ng-content></ng-content></p>`,
  styleUrls: ['./text.scss']
})
export class DbNgxSuccessComponent {

  @Input()
  text: string;

}
