import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatDialog, MatDialogRef, MatDialogConfig } from '@angular/material/dialog';
import { DbxInjectionComponent, DbxInjectionComponentConfig } from '@dereekb/dbx-core';
import { AbstractDialogDirective } from './abstract.dialog.directive';
import { DbxDialogContentContainerWidth, DbxDialogContentDirective } from './dialog.content.directive';
import { DbxDialogContentCloseComponent } from './dialog.content.close.component';
import { Maybe } from '@dereekb/util';
import { NgClass } from '@angular/common';

export interface DbxInjectionDialogComponentConfig<T = unknown> extends Omit<MatDialogConfig, 'data'> {
  readonly contentWidth?: Maybe<DbxDialogContentContainerWidth>;
  readonly showCloseButton?: boolean;
  readonly componentConfig: DbxInjectionComponentConfig<T>;
}

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
    const dialogRef = matDialog.open(DbxInjectionDialogComponent<T>, {
      width: '80vw',
      height: '80vh',
      ...config,
      data: config
    });

    return dialogRef;
  }
}
