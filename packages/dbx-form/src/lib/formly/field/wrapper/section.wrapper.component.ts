import { Component } from '@angular/core';
import { Maybe } from '@dereekb/util';
import { FieldWrapper } from '@ngx-formly/core';

@Component({
  template: `
    <div class="form-section">
      <h3>{{ to.label }}</h3>
      <div class="form-section-content">
        <ng-container #fieldComponent></ng-container>
      </div>
      <dbx-hint *ngIf="description">{{ description }}</dbx-hint>
    </div>
  `,
  // TODO: styleUrls: ['./wrapper.scss']
})
export class FormSectionWrapperComponent extends FieldWrapper {

  get description(): Maybe<string> {
    return this.to.description;
  }

}
