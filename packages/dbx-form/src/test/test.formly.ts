import { NoopAnimationsModule } from "@angular/platform-browser/animations";
import { FormlyModule } from "@ngx-formly/core";
import { FormlyMaterialModule } from "@ngx-formly/material";
import { DbxFormlyModule } from "../lib/formly/formly.module";

export const FORMLY_TEST_PROVIDERS = [
  FormlyModule.forRoot({
    extras: { lazyRender: true }
  }),
  FormlyMaterialModule
];

export const FORM_TEST_PROVIDERS = [
  DbxFormlyModule,
  ...FORMLY_TEST_PROVIDERS,
  NoopAnimationsModule
];
