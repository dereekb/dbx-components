import { type OnInit, type OnDestroy, Component, ChangeDetectionStrategy } from '@angular/core';
import { DbxLoadingComponent } from '@dereekb/dbx-web';
import { SimpleLoadingContext } from '@dereekb/rxjs';
import { FieldWrapper, type FormlyFieldConfig } from '@ngx-formly/core';
import { cleanSubscription } from '@dereekb/dbx-core';

/**
 * No configurable value for now.
 */
export type DbxFormWorkingWrapperConfig = object;

/**
 * Adds a loading bar to help signify asynchronous work is occuring.
 *
 * By default shows loading during asynchronous validation of a field (FormControl status is "PENDING")
 */
@Component({
  template: `
    <div class="dbx-form-working-wrapper">
      <ng-container #fieldComponent></ng-container>
      <dbx-loading [linear]="true" [context]="workingContext"></dbx-loading>
    </div>
  `,
  imports: [DbxLoadingComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxFormWorkingWrapperComponent extends FieldWrapper<FormlyFieldConfig<DbxFormWorkingWrapperConfig>> implements OnInit, OnDestroy {
  readonly sub = cleanSubscription();
  readonly workingContext = new SimpleLoadingContext(false);

  ngOnInit(): void {
    this.sub.subscription = this.formControl?.statusChanges.subscribe({
      next: (x) => this.workingContext.setLoading(x === 'PENDING')
    });
  }

  ngOnDestroy(): void {
    this.workingContext.destroy();
  }
}
