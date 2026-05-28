import { Directive, Injector, inject, input } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { first, map } from 'rxjs';
import { type Maybe } from '@dereekb/util';
import { DbxButton, type DbxInjectionComponentConfig } from '@dereekb/dbx-core';
import { DbxPdfMergeEditorStore } from './pdf.merge.editor.store';
import { DbxPdfMergeUploadDialogComponent, type DbxPdfMergeUploadDialogUploadButtonConfig } from './pdf.merge.upload.dialog.component';

/**
 * Configuration for {@link DbxPdfMergeUploadButtonDirective}. Carries only dialog-related options — the trigger button's appearance is owned by the host {@link DbxButton} (its own `text`, `icon`, `raised`, `color`, `buttonStyle` inputs).
 */
export interface DbxPdfMergeUploadButtonConfig {
  /**
   * Optional component config rendered inside the dialog in place of the default {@link DbxPdfMergeEditorComponent}. Leave {@link DbxInjectionComponentConfig.injector} unset so the injected component inherits the dialog's injector and resolves the ancestor {@link DbxPdfMergeEditorStore}.
   */
  readonly customDialogContent?: Maybe<DbxInjectionComponentConfig>;
  /**
   * When `false`, the dialog's footer Upload button is hidden — useful when the projected content provides its own confirm affordance.
   */
  readonly showUploadButton?: Maybe<boolean>;
  /**
   * Display overrides for the dialog's footer Upload button — text, icon, color, raised, variant flags, button style.
   */
  readonly uploadButtonConfig?: Maybe<DbxPdfMergeUploadDialogUploadButtonConfig>;
}

/**
 * Drop-in interceptor for a stock `<dbx-button>` that opens {@link DbxPdfMergeUploadDialogComponent} on click. The click is allowed to propagate (so a sibling `dbxActionButton` can call `source.trigger()`) only when the user confirms the upload from inside the dialog — closing the dialog without confirming drops the click.
 *
 * Action-blind by design — this directive only links a `<dbx-button>` to the merge dialog. To bridge the result into a surrounding `dbxAction`, compose with {@link DbxPdfMergeUploadActionDirective} (`[dbxPdfMergeUploadAction]`), which listens for the action's `triggered$` and supplies `store.mergeOutput$` to `source.readyValue()`. The trio composes on a stock `<dbx-button>` alongside `dbxActionButton`:
 *
 * - Host `<dbx-button>` owns its own appearance (`text`, `icon`, `raised`, `color`, …).
 * - `dbxActionButton` drives `working`/`disabled` from the action and calls `source.trigger()` on click.
 * - `dbxPdfMergeUploadButton` (this directive) intercepts the click, opens the dialog, and resolves the interceptor with `true` only when the user confirms.
 * - `dbxPdfMergeUploadAction` reacts to `source.triggered$` by pulling the latest `store.mergeOutput$` into `source.readyValue(blob)` so the action handler runs with the merged PDF.
 *
 * An ancestor-provided {@link DbxPdfMergeEditorStore} is required — supply via {@link DbxPdfMergeEditorStoreDirective} on a wrapping element, or `providers: [DbxPdfMergeEditorStore]` on the parent component.
 *
 * @example
 * ```html
 * <div dbxAction [dbxActionHandler]="handleUpload">
 *   <div dbxPdfMergeEditorStore [config]="storeConfig">
 *     <dbx-button text="Upload PDF" icon="picture_as_pdf" raised color="primary" dbxActionButton dbxPdfMergeUploadAction [dbxPdfMergeUploadButton]="buttonConfig"></dbx-button>
 *   </div>
 * </div>
 * ```
 */
@Directive({
  selector: '[dbxPdfMergeUploadButton]',
  standalone: true
})
export class DbxPdfMergeUploadButtonDirective {
  readonly button = inject(DbxButton, { host: true });
  readonly store = inject(DbxPdfMergeEditorStore);

  readonly dbxPdfMergeUploadButton = input<Maybe<DbxPdfMergeUploadButtonConfig>, Maybe<DbxPdfMergeUploadButtonConfig | ''>>(undefined, {
    transform: (value) => (value === '' ? undefined : value)
  });

  constructor() {
    const matDialog = inject(MatDialog);
    const injector = inject(Injector);

    this.button.setButtonInterceptor({
      interceptButtonClick: () => {
        const config = this.dbxPdfMergeUploadButton();
        const ref = DbxPdfMergeUploadDialogComponent.openDialog(matDialog, {
          injector,
          componentConfig: config?.customDialogContent,
          showUploadButton: config?.showUploadButton,
          uploadButtonConfig: config?.uploadButtonConfig
        });

        return ref.afterClosed().pipe(
          first(),
          map((blob) => blob != null)
        );
      }
    });
  }
}
