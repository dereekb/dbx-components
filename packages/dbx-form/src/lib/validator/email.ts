import { Validators, ValidatorFn } from '@angular/forms';
import { HAS_WEBSITE_DOMAIN_NAME_REGEX } from '@dereekb/util';

export function isDomain(): ValidatorFn {
  return Validators.pattern(HAS_WEBSITE_DOMAIN_NAME_REGEX);
}
