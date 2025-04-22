import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { FieldTypeConfig, FieldWrapper } from '@ngx-formly/core';
import { delay } from 'rxjs';

/**
 * Wrapper than sets the field to "touched" when the value changes and the field is not pristine.
 */
@Component({
  template: `
    <ng-container #fieldComponent></ng-container>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class AutoTouchFieldWrapperComponent extends FieldWrapper<FieldTypeConfig> implements OnInit {
  ngOnInit(): void {
    this.formControl.valueChanges.pipe(delay(200)).subscribe(() => {
      if (!this.formControl.pristine && this.formControl.untouched) {
        this.formControl.markAsTouched();
        this.formControl.updateValueAndValidity();
      }
    });
  }
}
