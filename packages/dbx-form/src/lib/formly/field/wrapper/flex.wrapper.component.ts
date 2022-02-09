import { Component } from '@angular/core';
import { FieldWrapper } from '@ngx-formly/core';

@Component({
  template: `
    <div class="form-flex-section">
      <ng-container #fieldComponent></ng-container>
    </div>
  `// todo: try using host
})
export class FormFlexWrapperComponent extends FieldWrapper { }
