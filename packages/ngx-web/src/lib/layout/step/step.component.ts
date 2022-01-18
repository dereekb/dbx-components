import { Component, Input, OnInit } from '@angular/core';

@Component({
  selector: 'dbx-step',
  templateUrl: './step.component.html',
  styleUrls: ['./step.scss']
})
export class DbNgxStepComponent {

  @Input()
  done: boolean;

  @Input()
  step: number;

  @Input()
  text: string;

  @Input()
  hint: string;

}
