import { Validators } from '@angular/forms';
import { FormlyFieldConfig } from '@ngx-formly/core/lib/core';
import { formlyField } from './field';

export function hiddenField({ key, required = false }): FormlyFieldConfig {
  return formlyField({
    key,
    templateOptions: {
      required
    }
  });
}
