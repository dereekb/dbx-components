import { Validators, ValidatorFn } from '@angular/forms';

export const DOMAIN_NAME_REGEX = /(.+)\.(.+)/;

export function IsDomain(): ValidatorFn {
  return Validators.pattern(DOMAIN_NAME_REGEX);
}
