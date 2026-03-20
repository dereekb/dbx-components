import { ChangeDetectionStrategy, Component } from '@angular/core';
import { type MatDialog, type MatDialogRef, type MatDialogConfig } from '@angular/material/dialog';
import { DbxInjectionComponent, type DbxInjectionComponentConfig } from '@dereekb/dbx-core';
import { AbstractDialogDirective } from './abstract.dialog.directive';
import { type DbxDialogContentContainerWidth, DbxDialogContentDirective } from './dialog.content.directive';
import { DbxDialogContentCloseComponent } from './dialog.content.close.component';
import { type Maybe } from '@dereekb/util';
import { NgClass } from '@angular/common';

/**
 * Configuration for opening a dialog with a dynamically injected component.
 */
export interface DbxInjectionDialogComponentConfig<T = unknown> extends Omit<MatDialogConfig, 'data'> {
  readonly contentWidth?: Maybe<DbxDialogContentContainerWidth>;
  readonly showCloseButton?: boolean;
  readonly componentConfig: DbxInjectionComponentConfig<T>;
}

/**
 * Dialog component that renders a dynamically injected component using {@link DbxInjectionComponent}.
 *
 * Use the static `openDialog` method to open the dialog with a given component configuration.
 *
 * @example
 * ```ts
 * DbxInjectionDialogComponent.openDialog(matDialog, {
 *   componentConfig: { componentClass: MyComponent },
 *   showCloseButton: true,
 *   contentWidth: 'wide'
 * });
 * ```
 */
@Component({
  template: `
    <dbx-dialog-content class="dbx-dialog-content-100" [ngClass]="{ 'dbx-dialog-content-100-padded-closed': showCloseButton }" [width]="contentWidth">
      @if (showCloseButton) {
        <dbx-dialog-content-close (close)="close()"></dbx-dialog-content-close>
      }
      <dbx-injection [config]="componentConfig"></dbx-injection>
    </dbx-dialog-content>
  `,
  imports: [DbxInjectionComponent, DbxDialogContentDirective, DbxDialogContentCloseComponent, NgClass],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxInjectionDialogComponent<T = unknown> extends AbstractDialogDirective<void, DbxInjectionDialogComponentConfig<T>> {
  get showCloseButton() {
    return this.data.showCloseButton ?? true;
  }

  get contentWidth() {
    return this.data.contentWidth;
  }

  get componentConfig() {
    return this.data.componentConfig;
  }

  static openDialog<T>(matDialog: MatDialog, config: DbxInjectionDialogComponentConfig<T>): MatDialogRef<DbxInjectionDialogComponent<T>, void> {
    return matDialog.open(DbxInjectionDialogComponent<T>, {
      width: '80vw',
      height: '80vh',
      ...config,
      data: config
    });
  }
}
