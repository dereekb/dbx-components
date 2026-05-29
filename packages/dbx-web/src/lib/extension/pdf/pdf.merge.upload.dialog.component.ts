import { ChangeDetectionStrategy, Component, type Injector, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { type MatDialog, type MatDialogRef } from '@angular/material/dialog';
import { type ThemePalette } from '@angular/material/core';
import { first } from 'rxjs';
import { type Maybe } from '@dereekb/util';
import { DbxInjectionComponent, type DbxInjectionComponentConfig } from '@dereekb/dbx-core';
import { AbstractDialogDirective } from '../../interaction/dialog/abstract.dialog.directive';
import { DbxDialogContentDirective } from '../../interaction/dialog/dialog.content.directive';
import { DbxDialogContentCloseComponent } from '../../interaction/dialog/dialog.content.close.component';
import { DbxButtonComponent } from '../../button/button.component';
import { type DbxButtonStyle } from '../../button/button';
import { type DbxColorInput } from '../../layout/style/style';
import { provideDbxPdfMergeEditorPreserveEntriesOnSlotDestroy } from './pdf.merge';
import { DbxPdfMergeEditorComponent } from './pdf.merge.editor.component';
import { DbxPdfMergeEditorStore } from './pdf.merge.editor.store';

const DEFAULT_UPLOAD_FOOTER_ICON = 'cloud_upload';
const DEFAULT_UPLOAD_FOOTER_TEXT = 'Upload';
const DEFAULT_UPLOAD_FOOTER_COLOR: ThemePalette = 'primary';
const DEFAULT_UPLOAD_FOOTER_RAISED = true;

/**
 * Display config for the dialog's footer Upload button.
 *
 * Each field is optional — omit any field to inherit the dialog's defaults (`text: 'Upload'`, `icon: 'cloud_upload'`, `color: 'primary'`, `raised: true`). Set a boolean variant flag (`flat`, `stroked`, `tonal`, `basic`) together with `raised: false` to switch the Material button variant.
 */
export interface DbxPdfMergeUploadDialogUploadButtonConfig {
  readonly text?: Maybe<string>;
  readonly icon?: Maybe<string>;
  readonly style?: Maybe<DbxButtonStyle>;
  readonly color?: Maybe<ThemePalette | DbxColorInput>;
  readonly raised?: Maybe<boolean>;
  readonly flat?: Maybe<boolean>;
  readonly stroked?: Maybe<boolean>;
  readonly tonal?: Maybe<boolean>;
  readonly basic?: Maybe<boolean>;
}

/**
 * Configuration for {@link DbxPdfMergeUploadDialogComponent.openDialog}.
 *
 * The {@link injector} is required: it is forwarded to {@link MatDialog.open} so the dialog's content shares the caller's element-injector tree and resolves the ancestor-provided {@link DbxPdfMergeEditorStore}. Pass the {@link Injector} obtained at the call site (typically the button's `inject(Injector)`).
 *
 * When {@link componentConfig} is supplied, the dialog renders a {@link DbxInjectionComponent} bound to that config in place of the default {@link DbxPdfMergeEditorComponent}. Do NOT set `componentConfig.injector` if you want the injected component to resolve the ancestor store — leaving it undefined lets {@link DbxInjectionComponent} resolve from the dialog's own injector.
 *
 * Set {@link showUploadButton} to `false` to hide the footer Upload button — useful when the projected content provides its own confirm affordance (or when the dialog is purely informational and the caller reads from the store on close).
 */
export interface DbxPdfMergeUploadDialogConfig {
  readonly injector: Injector;
  readonly componentConfig?: Maybe<DbxInjectionComponentConfig>;
  readonly showUploadButton?: Maybe<boolean>;
  readonly uploadButtonConfig?: Maybe<DbxPdfMergeUploadDialogUploadButtonConfig>;
}

/**
 * Dialog content that hosts the PDF merge editor (or a caller-supplied alternative) inside a {@link MatDialog}. Closes with the merged {@link Blob} when the user clicks the footer Upload button.
 *
 * The dialog inherits its caller's injector via {@link MatDialog.open}'s `injector` option, so an ancestor-provided {@link DbxPdfMergeEditorStore} is shared with the embedded editor. The footer Upload button is disabled while the store reports invalid (`isValid$ === false`) or while there are no ready entries, and renders a spinner while validation is in flight. Closing the dialog without uploading leaves the store's entries intact so the user can reopen and resume.
 *
 * Use {@link DbxPdfMergeUploadButtonComponent} to open this dialog with the canonical configuration, or call {@link DbxPdfMergeUploadDialogComponent.openDialog} directly.
 */
@Component({
  selector: 'dbx-pdf-merge-upload-dialog',
  template: `
    <dbx-dialog-content>
      <dbx-dialog-content-close (close)="close()"></dbx-dialog-content-close>
      @if (componentConfigSignal(); as componentConfig) {
        <dbx-injection [config]="componentConfig"></dbx-injection>
      } @else {
        <dbx-pdf-merge-editor [showPreviewButton]="true" [showDownloadButton]="false"></dbx-pdf-merge-editor>
      }
      @if (showUploadButtonSignal()) {
        <div class="dbx-pdf-merge-upload-dialog-footer">
          <dbx-button [icon]="uploadIconSignal()" [text]="uploadTextSignal()" [buttonStyle]="uploadStyleSignal()" [color]="uploadColorSignal()" [raised]="uploadRaisedSignal()" [flat]="uploadFlatSignal()" [stroked]="uploadStrokedSignal()" [tonal]="uploadTonalSignal()" [basic]="uploadBasicSignal()" [working]="uploadWorkingSignal()" [disabled]="uploadDisabledSignal()" (buttonClick)="confirmUpload()"></dbx-button>
        </div>
      }
    </dbx-dialog-content>
  `,
  host: {
    class: 'dbx-pdf-merge-upload-dialog'
  },
  providers: [provideDbxPdfMergeEditorPreserveEntriesOnSlotDestroy(true)],
  standalone: true,
  imports: [DbxDialogContentDirective, DbxDialogContentCloseComponent, DbxInjectionComponent, DbxPdfMergeEditorComponent, DbxButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DbxPdfMergeUploadDialogComponent extends AbstractDialogDirective<Blob, DbxPdfMergeUploadDialogConfig> {
  readonly store = inject(DbxPdfMergeEditorStore);

  readonly componentConfigSignal = computed<Maybe<DbxInjectionComponentConfig>>(() => this.data?.componentConfig);
  readonly showUploadButtonSignal = computed<boolean>(() => this.data?.showUploadButton !== false);
  readonly uploadIconSignal = computed<Maybe<string>>(() => this.data?.uploadButtonConfig?.icon ?? DEFAULT_UPLOAD_FOOTER_ICON);
  readonly uploadTextSignal = computed<Maybe<string>>(() => this.data?.uploadButtonConfig?.text ?? DEFAULT_UPLOAD_FOOTER_TEXT);
  readonly uploadStyleSignal = computed<Maybe<DbxButtonStyle>>(() => this.data?.uploadButtonConfig?.style);
  readonly uploadColorSignal = computed<Maybe<ThemePalette | DbxColorInput>>(() => this.data?.uploadButtonConfig?.color ?? DEFAULT_UPLOAD_FOOTER_COLOR);
  readonly uploadRaisedSignal = computed<boolean>(() => this.data?.uploadButtonConfig?.raised ?? DEFAULT_UPLOAD_FOOTER_RAISED);
  readonly uploadFlatSignal = computed<boolean>(() => this.data?.uploadButtonConfig?.flat ?? false);
  readonly uploadStrokedSignal = computed<boolean>(() => this.data?.uploadButtonConfig?.stroked ?? false);
  readonly uploadTonalSignal = computed<boolean>(() => this.data?.uploadButtonConfig?.tonal ?? false);
  readonly uploadBasicSignal = computed<boolean>(() => this.data?.uploadButtonConfig?.basic ?? false);

  readonly uploadWorkingSignal = toSignal(this.store.isValidating$, { initialValue: false });
  private readonly _hasReadyEntriesSignal = toSignal(this.store.hasReadyEntries$, { initialValue: false });
  private readonly _isValidSignal = toSignal(this.store.isValid$, { initialValue: true });

  readonly uploadDisabledSignal = computed<boolean>(() => {
    const hasReady = this._hasReadyEntriesSignal();
    const isValid = this._isValidSignal();
    return !hasReady || !isValid;
  });

  confirmUpload(): void {
    this.store.mergeOutput$.pipe(first()).subscribe((blob) => this.close(blob));
  }

  static openDialog(matDialog: MatDialog, config: DbxPdfMergeUploadDialogConfig): MatDialogRef<DbxPdfMergeUploadDialogComponent, Blob> {
    return matDialog.open<DbxPdfMergeUploadDialogComponent, DbxPdfMergeUploadDialogConfig, Blob>(DbxPdfMergeUploadDialogComponent, {
      panelClass: ['dbx-pdf-merge-upload-dialog'],
      width: '90vw',
      height: '90vh',
      maxWidth: '1200px',
      maxHeight: '900px',
      injector: config.injector,
      data: config
    });
  }
}
