import { Component } from '@angular/core';
import { ScreenMediaWidthType } from '@dereekb/dbx-web';
import { Maybe } from '@dereekb/util';
import { FieldWrapper, FormlyFieldConfig } from '@ngx-formly/core';

export interface DbxFlexWrapperConfig {
  breakpoint?: ScreenMediaWidthType;
  relative?: boolean;
}

export interface DbxFlexWrapperWrapperProps {
  flexWrapper?: DbxFlexWrapperConfig;
}

@Component({
  template: `
    <div class="dbx-form-flex-section" dbxFlexGroup [content]="false" [relative]="relative" [breakpoint]="breakpoint">
      <ng-container #fieldComponent></ng-container>
    </div>
  `
})
export class DbxFormFlexWrapperComponent extends FieldWrapper<FormlyFieldConfig<DbxFlexWrapperWrapperProps>> {
  get flexWrapper(): Maybe<DbxFlexWrapperConfig> {
    return this.props.flexWrapper;
  }

  get breakpoint() {
    return this.flexWrapper?.breakpoint;
  }

  get relative() {
    return this.flexWrapper?.relative ?? false;
  }
}
