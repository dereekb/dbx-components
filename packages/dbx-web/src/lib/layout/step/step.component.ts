import { Component, Input } from '@angular/core';

@Component({
  selector: 'dbx-step',
  templateUrl: './step.component.html',
  // TODO: styleUrls: ['./step.scss']
})
export class DbxStepComponent {

  @Input()
  done?: boolean;

  @Input()
  step?: number;

  @Input()
  text?: string;

  @Input()
  hint?: string;

}
