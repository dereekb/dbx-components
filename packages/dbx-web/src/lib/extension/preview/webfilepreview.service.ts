import { Inject, inject, Injectable, InjectionToken, Optional } from '@angular/core';
import { MatDialog, type MatDialogRef } from '@angular/material/dialog';
import { type MimeTypeWithoutParameters, type ArrayOrValue, asArray } from '@dereekb/util';
import { type DbxWebFilePreviewServiceEntry, type DbxWebFilePreviewServicePreviewComponentFunction, type DbxWebFilePreviewServicePreviewComponentFunctionInput, type DbxWebFilePreviewServicePreviewDialogFunction, type DbxWebFilePreviewServicePreviewDialogFunctionInput, type DbxWebFilePreviewServicePreviewDialogWithComponentFunction } from './webfilepreview';
import { DbxInjectionDialogComponent } from '../../interaction/dialog/dialog.injection.component';
import { DbxEmbedComponent, type DbxEmbedComponentElement } from '../../interaction/iframe/embed.component';

/**
 * Default entries to inject.
 */
export const DBX_WEB_FILE_PREVIEW_SERVICE_ENTRIES_TOKEN = new InjectionToken<DbxWebFilePreviewServiceEntry[]>('DefaultDbxWebFilePreviewServiceEntries');

/**
 * Creates a provider that registers the given entries with the {@link DbxWebFilePreviewService} via the {@link DBX_WEB_FILE_PREVIEW_SERVICE_ENTRIES_TOKEN}.
 *
 * @example
 * ```typescript
 * provideDbxWebFilePreviewServiceEntries([DBX_WEB_FILE_PREVIEW_SERVICE_ZIP_PRESET_ENTRY]);
 * ```
 */
export function provideDbxWebFilePreviewServiceEntries(entries: DbxWebFilePreviewServiceEntry[]) {
  return {
    provide: DBX_WEB_FILE_PREVIEW_SERVICE_ENTRIES_TOKEN,
    useValue: entries
  };
}

// MARK: Default Functions
/**
 * Default preset for previewing a file using a DbxEmbedDialogComponent.
 */
/**
 * Default preview component function that embeds files using {@link DbxEmbedComponent}. Images are rendered with an `img` element; all other types use `embed`.
 */
export const DBX_WEB_FILE_PREVIEW_SERVICE_DEFAULT_PREVIEW_COMPONENT_FUNCTION: DbxWebFilePreviewServicePreviewComponentFunction = (input) => {
  const { blob, srcUrl, embedMimeType, sanitizeSrcUrl } = input;

  let embedElement: DbxEmbedComponentElement = 'embed';

  if (embedMimeType) {
    // embed any image mime types to img
    embedElement = embedMimeType.startsWith('image/') ? 'img' : 'embed';
  }

  return {
    componentClass: DbxEmbedComponent,
    init: (x) => {
      x.embedElement.set(embedElement);

      if (blob != null) {
        x.blob.set(blob);
      }

      if (srcUrl != null) {
        x.srcUrl.set(srcUrl);
        x.sanitizeUrl.set(sanitizeSrcUrl ?? true);
      }

      if (embedMimeType != null) {
        x.type.set(embedMimeType);
      }
    }
  };
};

/**
 * Default dialog-with-component function that opens the preview component inside a {@link DbxInjectionDialogComponent} with a close button.
 */
export const DBX_WEB_FILE_PREVIEW_SERVICE_DEFAULT_DIALOG_WITH_COMPONENT_FUNCTION: DbxWebFilePreviewServicePreviewDialogWithComponentFunction = (input) => {
  const { matDialog, componentConfig } = input;
  return DbxInjectionDialogComponent.openDialog(matDialog, {
    componentConfig,
    showCloseButton: true
  });
};

// MARK: Service
/**
 * Service used for previewing files with given mime types.
 */
@Injectable({
  providedIn: 'root'
})
export class DbxWebFilePreviewService {
  readonly matDialog = inject(MatDialog);

  private readonly _entries = new Map<MimeTypeWithoutParameters | string, DbxWebFilePreviewServiceEntry>();

  constructor(@Optional() @Inject(DBX_WEB_FILE_PREVIEW_SERVICE_ENTRIES_TOKEN) entries: DbxWebFilePreviewServiceEntry[]) {
    if (entries) {
      entries.forEach((x) => this.registerPreviewEntry(x));
    }
  }

  private _defaultPreviewComponentFunction: DbxWebFilePreviewServicePreviewComponentFunction = DBX_WEB_FILE_PREVIEW_SERVICE_DEFAULT_PREVIEW_COMPONENT_FUNCTION;
  private _defaultPreviewDialogWithComponentFunction: DbxWebFilePreviewServicePreviewDialogWithComponentFunction = DBX_WEB_FILE_PREVIEW_SERVICE_DEFAULT_DIALOG_WITH_COMPONENT_FUNCTION;

  // Configuration
  /**
   * Registers one or more file preview entries, mapping MIME types to their preview components.
   *
   * @param entries - Single or array of preview entries to register
   */
  registerPreviewEntries(entries: ArrayOrValue<DbxWebFilePreviewServiceEntry>) {
    asArray(entries).forEach((entry) => this.registerPreviewEntry(entry));
  }

  /**
   * Registers a single file preview entry for its MIME type(s).
   *
   * @param entry - The preview entry to register
   */
  registerPreviewEntry(entry: DbxWebFilePreviewServiceEntry) {
    asArray(entry.mimeType).forEach((mimeType) => this._entries.set(mimeType, entry));
  }

  /**
   * Overrides the default preview component function used when no MIME-specific entry is registered.
   */
  setDefaultPreviewComponentFunction(previewFunction: DbxWebFilePreviewServicePreviewComponentFunction) {
    this._defaultPreviewComponentFunction = previewFunction;
  }

  /**
   * Overrides the default dialog-with-component function used when no MIME-specific dialog handler is registered.
   */
  setDefaultPreviewDialogWithComponentFunction(previewDialogWithComponentFunction: DbxWebFilePreviewServicePreviewDialogWithComponentFunction) {
    this._defaultPreviewDialogWithComponentFunction = previewDialogWithComponentFunction;
  }

  // Service
  /**
   * Creates an injection component config for previewing a file. Uses a MIME-specific preview function if registered, otherwise falls back to the default.
   *
   * @param input - The preview input containing blob, URL, and MIME type information
   */
  createPreviewConfig(input: DbxWebFilePreviewServicePreviewComponentFunctionInput) {
    const { embedMimeType } = input;

    const previewFunction = (embedMimeType ? this._entries.get(embedMimeType)?.previewComponentFunction : undefined) ?? this._defaultPreviewComponentFunction;
    return previewFunction(input);
  }

  /**
   * Opens a Material dialog to preview a file. Uses a MIME-specific dialog function if registered, otherwise creates a preview component and wraps it in the default dialog.
   *
   * @param input - The dialog input containing file data and MIME type
   * @returns Reference to the opened dialog
   */
  openPreviewDialog(input: DbxWebFilePreviewServicePreviewDialogFunctionInput): MatDialogRef<any, any> {
    const { embedMimeType } = input;
    const previewDialogFunction: DbxWebFilePreviewServicePreviewDialogFunction | undefined = embedMimeType ? this._entries.get(embedMimeType)?.previewDialogFunction : undefined;
    let matDialogRef: MatDialogRef<any, any>;

    if (previewDialogFunction) {
      matDialogRef = previewDialogFunction({
        matDialog: this.matDialog,
        ...input
      });
    } else {
      const componentConfig = this.createPreviewConfig(input);
      matDialogRef = this._defaultPreviewDialogWithComponentFunction({
        matDialog: this.matDialog,
        ...input,
        componentConfig
      });
    }

    return matDialogRef;
  }
}
