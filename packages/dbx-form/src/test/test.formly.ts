import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { FormlyModule } from '@ngx-formly/core';
import { FormlyMaterialModule } from '@ngx-formly/material';
import { DbxFormExtensionModule } from '../lib/form.module';

export const FORMLY_TEST_PROVIDERS = [
  FormlyModule.forRoot({
    extras: { lazyRender: true }
  }),
  FormlyMaterialModule
];

// eslint-disable-next-line @typescript-eslint/no-deprecated -- NoopAnimationsModule is needed here because FORM_TEST_PROVIDERS is spread into TestBed imports arrays
export const FORM_TEST_PROVIDERS = [DbxFormExtensionModule, ...FORMLY_TEST_PROVIDERS, NoopAnimationsModule];
