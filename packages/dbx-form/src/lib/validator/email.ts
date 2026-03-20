import { Validators, type ValidatorFn } from '@angular/forms';
import { HAS_WEBSITE_DOMAIN_NAME_REGEX } from '@dereekb/util';

/**
 * Angular form validator that checks whether the control value matches a website domain name pattern.
 *
 * @returns A ValidatorFn that validates against the domain name regex
 */
export function isDomain(): ValidatorFn {
  return Validators.pattern(HAS_WEBSITE_DOMAIN_NAME_REGEX);
}
