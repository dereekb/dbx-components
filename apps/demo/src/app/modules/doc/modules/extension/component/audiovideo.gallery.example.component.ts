import { ChangeDetectionStrategy, Component, computed } from '@angular/core';
import { AbstractDbxGallerySlotDirective, DbxAudioVideoPlaybackDirective, DbxAvatarComponent, DbxButtonComponent, type DbxGalleryImageValue, injectCopyToClipboardFunctionWithSnackbarMessage } from '@dereekb/dbx-web';
import { type Maybe, type WebsiteUrlWithPrefix } from '@dereekb/util';

/**
 * Kind of item shown in the audiovideo gallery demo.
 */
export type DocGalleryItemKind = 'color' | 'image' | 'gif' | 'avatar' | 'clip';

/**
 * An item shown in the audiovideo gallery demo.
 */
export interface DocGalleryItem extends Partial<DbxGalleryImageValue> {
  readonly id: string;
  readonly name: string;
  readonly kind: DocGalleryItemKind;
  /**
   * CSS color of a color item.
   */
  readonly color?: Maybe<string>;
}

/**
 * Callbacks passed to {@link DocGalleryActionsComponent} through its slot data.
 */
export interface DocGalleryActionsData {
  readonly onDelete: (item: DocGalleryItem) => void;
  readonly onLoad: (item: DocGalleryItem) => void;
}

/**
 * Solid color presentation.
 */
@Component({
  template: `
    <div class="doc-gallery-color" [style.background]="valueSignal().color">
      <span class="doc-gallery-color-label">{{ valueSignal().color }}</span>
    </div>
  `,
  styles: `
    .doc-gallery-color {
      display: flex;
      align-items: flex-end;
      justify-content: flex-end;
      width: 100%;
      height: 100%;
      box-sizing: border-box;
      padding: 6px;
    }

    .doc-gallery-color-label {
      font-family: monospace;
      font-size: 11px;
      padding: 2px 4px;
      border-radius: 4px;
      background: rgba(0, 0, 0, 0.45);
      color: white;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DocGalleryColorPresentationComponent extends AbstractDbxGallerySlotDirective<DocGalleryItem> {}

/**
 * Avatar presentation.
 */
@Component({
  template: `
    <div class="doc-gallery-avatar">
      <dbx-avatar [avatarName]="valueSignal().name" [avatarUrl]="avatarUrlSignal()" avatarSize="large"></dbx-avatar>
    </div>
  `,
  styles: `
    .doc-gallery-avatar {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      height: 100%;
    }
  `,
  imports: [DbxAvatarComponent],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DocGalleryAvatarPresentationComponent extends AbstractDbxGallerySlotDirective<DocGalleryItem> {
  readonly avatarUrlSignal = computed(() => this.valueSignal().src as Maybe<WebsiteUrlWithPrefix>);
}

/**
 * Muted looping clip presentation. Registered with the playback store, but muted playback does not count toward the limit.
 */
@Component({
  template: `
    <video class="doc-gallery-clip" [src]="valueSignal().src" autoplay muted loop playsinline dbxAudioVideoPlayback></video>
  `,
  styles: `
    .doc-gallery-clip {
      display: block;
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
  `,
  imports: [DbxAudioVideoPlaybackDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DocGalleryClipPresentationComponent extends AbstractDbxGallerySlotDirective<DocGalleryItem> {}

/**
 * Top slot label.
 */
@Component({
  template: `
    <div class="doc-gallery-label">
      <span class="doc-gallery-label-name">{{ valueSignal().name }}</span>
      <span class="dbx-hint">{{ valueSignal().kind }}</span>
    </div>
  `,
  styles: `
    .doc-gallery-label {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 4px;
      font-size: 12px;
    }

    .doc-gallery-label-name {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DocGalleryLabelComponent extends AbstractDbxGallerySlotDirective<DocGalleryItem> {}

/**
 * Bottom slot actions: copy, delete and load.
 */
@Component({
  template: `
    <div class="doc-gallery-actions">
      <dbx-button icon="content_copy" iconOnly (buttonClick)="copy()"></dbx-button>
      <dbx-button icon="delete" iconOnly color="warn" (buttonClick)="delete()"></dbx-button>
      <dbx-button icon="open_in_new" iconOnly color="primary" (buttonClick)="load()"></dbx-button>
    </div>
  `,
  styles: `
    .doc-gallery-actions {
      display: flex;
      justify-content: space-around;
    }
  `,
  imports: [DbxButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DocGalleryActionsComponent extends AbstractDbxGallerySlotDirective<DocGalleryItem, DocGalleryActionsData> {
  readonly copyToClipboard = injectCopyToClipboardFunctionWithSnackbarMessage();

  copy() {
    const value = this.valueSignal();
    let content: Maybe<string> = value.name;

    if (value.kind === 'color') {
      content = value.color;
    } else if (value.src) {
      content = new URL(value.src, window.location.href).href;
    }

    void this.copyToClipboard(content ?? value.name);
  }

  delete() {
    this.data?.onDelete(this.valueSignal());
  }

  load() {
    this.data?.onLoad(this.valueSignal());
  }
}
