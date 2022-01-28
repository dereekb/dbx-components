import { Component } from '@angular/core';
import { FieldWrapper } from '@ngx-formly/core';

@Component({
  template: `
    <div class="form-flex-section">
      <ng-container #fieldComponent></ng-container>
    </div>
  `,
  // TODO: styleUrls: ['./wrapper.scss']
})
export class FormFlexWrapperComponent extends FieldWrapper { }
