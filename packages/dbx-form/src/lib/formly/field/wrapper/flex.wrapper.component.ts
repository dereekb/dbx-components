import { Component } from '@angular/core';
import { ScreenMediaWidthType } from '@dereekb/dbx-web';
import { FieldWrapper, FormlyFieldConfig } from '@ngx-formly/core';

export interface DbxFlexWrapperConfig {
  breakpoint?: ScreenMediaWidthType;
  relative?: boolean;
}

@Component({
  template: `
    <div class="dbx-form-flex-section" dbxFlexGroup [content]="false" [relative]="relative" [breakpoint]="breakpoint">
      <ng-container #fieldComponent></ng-container>
    </div>
  `
})
export class DbxFormFlexWrapperComponent extends FieldWrapper<FormlyFieldConfig<DbxFlexWrapperConfig>> {
  get flexWrapper(): DbxFlexWrapperConfig {
    return this.props;
  }

  get breakpoint() {
    return this.flexWrapper.breakpoint;
  }

  get relative() {
    return this.flexWrapper.relative ?? false;
  }
}
