import { OnInit, OnDestroy } from '@angular/core';
import { SimpleLoadingContext, SubscriptionObject } from '@dereekb/rxjs';
import { Component } from '@angular/core';
import { FieldWrapper, FormlyFieldConfig } from '@ngx-formly/core';

/**
 * No configurable value for now.
 */
export type DbxFormWorkingWrapperConfig = object;

export interface DbxFormWorkingWrapperFormlyConfig extends FormlyFieldConfig {
  styleWrapper: DbxFormWorkingWrapperConfig;
}

/**
 * Adds a loading bar to help signify asynchronos work is occuring.
 * 
 * By default shows loading during asynchronous validation of a field (FormControl status is "PENDING")
 */
@Component({
  template: `
    <div class="dbx-form-working-wrapper">
      <ng-container #fieldComponent></ng-container>
      <dbx-loading [linear]="true" [context]="workingContext"></dbx-loading>
    </div>
  `
})
export class DbxFormWorkingWrapperComponent extends FieldWrapper<DbxFormWorkingWrapperFormlyConfig> implements OnInit, OnDestroy {

  readonly sub = new SubscriptionObject();
  readonly workingContext = new SimpleLoadingContext(false);

  ngOnInit(): void {
    this.sub.subscription = this.formControl?.statusChanges.subscribe({
      next: (x) => this.workingContext.setLoading(x === 'PENDING')
    });
  }

  ngOnDestroy(): void {
    this.workingContext.destroy();
    this.sub.destroy();
  }

}
