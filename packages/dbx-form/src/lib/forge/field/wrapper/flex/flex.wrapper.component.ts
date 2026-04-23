import { ChangeDetectionStrategy, Component, input, viewChild, ViewContainerRef } from '@angular/core';
import { DbxFlexGroupDirective, type ScreenMediaWidthType } from '@dereekb/dbx-web';
import { type FieldWrapperContract } from '@ng-forge/dynamic-forms';

/**
 * Forge wrapper component that arranges child fields in a responsive flex layout
 * using the `dbxFlexGroup` directive.
 *
 * Registered as forge wrapper `'dbx-forge-flex'`.
 */
@Component({
  selector: 'dbx-forge-flex-wrapper',
  template: `
    <div class="dbx-form-flex-section" dbxFlexGroup [content]="false" [relative]="relative()" [breakpoint]="breakpoint()" [breakToColumn]="breakToColumn()">
      <ng-container #fieldComponent></ng-container>
    </div>
  `,
  imports: [DbxFlexGroupDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxForgeFlexWrapperComponent implements FieldWrapperContract {
  readonly fieldComponent = viewChild.required('fieldComponent', { read: ViewContainerRef });

  readonly breakpoint = input<ScreenMediaWidthType | undefined>();
  readonly relative = input<boolean>(false);
  readonly breakToColumn = input<boolean>(false);
}
