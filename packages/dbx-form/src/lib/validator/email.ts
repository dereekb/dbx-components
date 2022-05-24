import { Validators, ValidatorFn } from '@angular/forms';

export const DOMAIN_NAME_REGEX = /(.+)\.(.+)/;

export function isDomain(): ValidatorFn {
  return Validators.pattern(DOMAIN_NAME_REGEX);
}
