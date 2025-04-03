import { ChangeDetectionStrategy, Component } from '@angular/core';
import { DbxFormlyContext, provideFormlyContext } from './formly.context';

export const FORMLY_FORM_COMPONENT_TEMPLATE: Pick<Component, 'template' | 'imports' | 'providers' | 'changeDetection'> = {
  template: `<dbx-formly></dbx-formly>`,
  imports: [DbxFormlyContext],
  providers: [provideFormlyContext()],
  changeDetection: ChangeDetectionStrategy.OnPush
};
