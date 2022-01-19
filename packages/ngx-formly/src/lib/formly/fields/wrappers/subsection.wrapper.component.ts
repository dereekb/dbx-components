import { Component } from '@angular/core';
import { FieldWrapper } from '@ngx-formly/core';

@Component({
  template: `
    <div class="form-section form-subsection">
      <h4>{{ to.label }}</h4>
      <div class="form-section-content">
        <ng-container #fieldComponent></ng-container>
      </div>
      <dbx-hint *ngIf="description"><small>{{ description }}</small></dbx-hint>
    </div>
  `,
  styleUrls: ['./wrapper.scss']
})
export class FormSubsectionWrapperComponent extends FieldWrapper {

  get description(): string {
    return this.to.description;
  }

}
