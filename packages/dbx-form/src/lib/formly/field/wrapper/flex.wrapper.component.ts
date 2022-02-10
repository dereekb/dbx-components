import { Component } from '@angular/core';
import { ScreenMediaWidthType } from '@dereekb/dbx-web';
import { Maybe } from '@dereekb/util';
import { FieldWrapper, FormlyFieldConfig, FormlyTemplateOptions } from '@ngx-formly/core';

export interface DbxFlexWrapperConfig {
  breakpoint?: ScreenMediaWidthType;
  relative?: boolean;
}

export interface DbxFlexWrapperWrapperTemplateOptions extends FormlyTemplateOptions {
  flexWrapper?: DbxFlexWrapperConfig;
}

export interface DbxFlexWrapperWrapperConfig extends FormlyFieldConfig {
  templateOptions?: DbxFlexWrapperWrapperTemplateOptions;
}

@Component({
  template: `
    <div class="dbx-form-flex-section" dbxFlexGroup [content]="false" [relative]="relative" [breakpoint]="breakpoint">
      <ng-container #fieldComponent></ng-container>
    </div>
  `
})
export class DbxFormFlexWrapperComponent extends FieldWrapper<DbxFlexWrapperWrapperConfig> {

  get flexWrapper(): Maybe<DbxFlexWrapperConfig> {
    return this.to.flexWrapper;
  }

  get breakpoint() {
    return this.flexWrapper?.breakpoint;
  }

  get relative() {
    return this.flexWrapper?.relative ?? false;
  }

}
