import { Component, Input, OnInit } from '@angular/core';

@Component({
  selector: 'dbx-note',
  template: `<p class="dbx-note"><ng-content></ng-content></p>`,
  styleUrls: ['./text.scss']
})
export class DbNgxNoteComponent {

  @Input()
  text: string;

}
