import { Validators, ValidatorFn } from '@angular/forms';
import { WEBSITE_DOMAIN_NAME_REGEX } from '@dereekb/util';

export function isDomain(): ValidatorFn {
  return Validators.pattern(WEBSITE_DOMAIN_NAME_REGEX);
}
