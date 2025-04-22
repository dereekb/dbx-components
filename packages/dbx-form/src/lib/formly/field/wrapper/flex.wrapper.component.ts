import { ChangeDetectionStrategy, Component } from '@angular/core';
import { DbxFlexGroupDirective, ScreenMediaWidthType } from '@dereekb/dbx-web';
import { FieldWrapper, FormlyFieldConfig } from '@ngx-formly/core';

export interface DbxFlexWrapperConfig {
  /**
   * Breakpoint based on the screen width.
   */
  readonly breakpoint?: ScreenMediaWidthType;
  /**
   * Whether or not to use relative sizing.
   */
  readonly relative?: boolean;
  /**
   * Whether or not to break to a new column when the breakpoint is reached.
   */
  readonly breakToColumn?: boolean;
}

@Component({
  template: `
    <div class="dbx-form-flex-section" dbxFlexGroup [content]="false" [relative]="relative" [breakpoint]="breakpoint" [breakToColumn]="breakToColumn">
      <ng-container #fieldComponent></ng-container>
    </div>
  `,
  imports: [DbxFlexGroupDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
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

  get breakToColumn() {
    return this.flexWrapper.breakToColumn ?? false;
  }
}
