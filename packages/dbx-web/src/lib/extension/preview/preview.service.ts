import { Inject, inject, Injectable, InjectionToken, Optional } from '@angular/core';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { WebsiteUrlWithPrefix, Maybe, ContentTypeMimeType, MimeTypeWithoutParameters, ArrayOrValue, setKeysOnMap, asArray } from '@dereekb/util';
import { DbxWebFilePreviewServiceEntry, DbxWebFilePreviewServicePreviewFunction } from './preview';
import { DBX_WEB_FILE_PREVIEW_SERVICE_DEFAULT_PRESET } from './preview.service.preset';

/**
 * Default entries to inject.
 */
export const DBX_WEB_FILE_PREVIEW_SERVICE_ENTRIES_TOKEN = new InjectionToken<DbxWebFilePreviewServiceEntry[]>('DefaultDbxWebFilePreviewServiceEntries');

export function provideDbxWebFilePreviewServiceEntries(entries: DbxWebFilePreviewServiceEntry[]) {
  return {
    provide: DBX_WEB_FILE_PREVIEW_SERVICE_ENTRIES_TOKEN,
    useValue: entries
  };
}

/**
 * Service used for previewing files with given mime types.
 */
@Injectable({
  providedIn: 'root'
})
export class DbxWebFilePreviewService {
  readonly matDialog = inject(MatDialog);

  private readonly _entries = new Map<MimeTypeWithoutParameters | string, DbxWebFilePreviewServicePreviewFunction>();

  constructor(@Optional() @Inject(DBX_WEB_FILE_PREVIEW_SERVICE_ENTRIES_TOKEN) entries: DbxWebFilePreviewServiceEntry[]) {
    if (entries) {
      entries.forEach((x) => this.registerPreviewFunctions(x.mimeType, x.previewFunction));
    }
  }

  private _defaultPreviewFunction: DbxWebFilePreviewServicePreviewFunction = DBX_WEB_FILE_PREVIEW_SERVICE_DEFAULT_PRESET;

  // Configuration
  registerPreviewEntries(entries: ArrayOrValue<DbxWebFilePreviewServiceEntry>) {
    asArray(entries).forEach((entry) => this.registerPreviewFunctions(entry.mimeType, entry.previewFunction));
  }

  /**
   * Registers a preview function for the given mime type(s).
   */
  registerPreviewFunctions(mimeType: ArrayOrValue<MimeTypeWithoutParameters | string>, previewFunction: DbxWebFilePreviewServicePreviewFunction) {
    setKeysOnMap(this._entries, mimeType, previewFunction);
  }

  setDefaultPreviewFunction(previewFunction: DbxWebFilePreviewServicePreviewFunction) {
    this._defaultPreviewFunction = previewFunction;
  }

  // Service
  openPreviewDialog(srcUrl: WebsiteUrlWithPrefix, embedMimeType?: Maybe<ContentTypeMimeType | string>): MatDialogRef<any, any> {
    const previewFunction = (embedMimeType ? this._entries.get(embedMimeType) : undefined) ?? this._defaultPreviewFunction;
    return previewFunction(this.matDialog, srcUrl, embedMimeType);
  }
}
