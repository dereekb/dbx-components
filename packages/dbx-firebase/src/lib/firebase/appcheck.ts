import { AppCheckOptions } from '@firebase/app-check';

export interface DbxFirebaseAppCheckConfig extends Partial<Omit<AppCheckOptions, 'provider'>> {
  reCaptchaV3: string;
  disabled?: boolean;
}
