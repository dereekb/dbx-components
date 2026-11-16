import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { successResult } from '@dereekb/rxjs';
import { type DbxInjectionComponentConfig } from '@dereekb/dbx-core';
import {
  DbxAudioVideoPlaybackDirective,
  DbxAudioVideoPlaybackGroupDirective,
  type DbxAudioVideoPlaybackOverflowMode,
  DbxAudioVideoPlaybackStore,
  DbxButtonComponent,
  DbxContentContainerDirective,
  DbxDetailBlockComponent,
  type DbxGalleryConfig,
  DbxGalleryComponent,
  DbxGalleryImagePresentationComponent,
  DbxImageHoverPreviewDirective,
  DbxListItemSingleSelectionModifierDirective,
  DbxListSingleSelectionStore,
  type DbxListSingleSelectionChange,
  DbxValueListItemModifierDirective,
  DbxWebFilePreviewService
} from '@dereekb/dbx-web';
import { type WebsiteUrlWithPrefix } from '@dereekb/util';
import { DocFeatureLayoutComponent } from '../../shared/component/feature.layout.component';
import { DocFeatureExampleComponent } from '../../shared/component/feature.example.component';
import { type DocGalleryActionsData, DocGalleryActionsComponent, DocGalleryAvatarPresentationComponent, DocGalleryClipPresentationComponent, DocGalleryColorPresentationComponent, type DocGalleryItem, DocGalleryLabelComponent } from '../component/audiovideo.gallery.example.component';

const AUDIO_VIDEO_ASSETS_PATH = 'assets/test/audiovideo';

/**
 * Makes `count` solid color items by sweeping the hue, starting at `offset`.
 *
 * @param count - Number of items to make.
 * @param offset - Index of the first item, used for unique ids and to continue the sweep.
 * @returns The color items.
 */
function makeDocGalleryColorItems(count: number, offset = 0): DocGalleryItem[] {
  return Array.from({ length: count }, (_, i) => {
    const index = offset + i;
    const hue = Math.round((index * 137.5) % 360);
    const color = hslToHex(hue, 65, 55);
    return { id: `color_${index}`, name: `Color ${index + 1}`, kind: 'color', color };
  });
}

function hslToHex(h: number, s: number, l: number): string {
  const sat = s / 100;
  const light = l / 100;
  const a = sat * Math.min(light, 1 - light);
  const channel = (n: number) => {
    const k = (n + h / 30) % 12;
    const value = light - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(255 * value)
      .toString(16)
      .padStart(2, '0');
  };

  return `#${channel(0)}${channel(8)}${channel(4)}`;
}

function makeDocGalleryItems(): DocGalleryItem[] {
  const colors = makeDocGalleryColorItems(30);

  const mixed: DocGalleryItem[] = [
    { id: 'image_1', name: 'Test Pattern', kind: 'image', src: `${AUDIO_VIDEO_ASSETS_PATH}/image-1.jpg`, alt: 'Test pattern' },
    { id: 'image_2', name: 'Mandelbrot', kind: 'image', src: `${AUDIO_VIDEO_ASSETS_PATH}/image-2.jpg`, alt: 'Mandelbrot' },
    { id: 'image_3', name: 'SMPTE Bars', kind: 'image', src: `${AUDIO_VIDEO_ASSETS_PATH}/image-3.jpg`, alt: 'SMPTE bars' },
    { id: 'avatar_1', name: 'Avatar', kind: 'avatar', src: 'assets/test/avatar.png' },
    { id: 'gif_1', name: 'Spinner', kind: 'gif', src: `${AUDIO_VIDEO_ASSETS_PATH}/spinner.gif`, alt: 'Spinner' },
    { id: 'clip_1', name: 'Muted Clip', kind: 'clip', src: `${AUDIO_VIDEO_ASSETS_PATH}/clip.mp4` }
  ];

  // mix the debug items in between the colors
  const result = [...colors];
  mixed.forEach((item, i) => result.splice(2 + i * 5, 0, item));
  return result;
}

@Component({
  templateUrl: './audiovideo.component.html',
  imports: [
    DbxContentContainerDirective,
    DocFeatureLayoutComponent,
    DocFeatureExampleComponent,
    DbxAudioVideoPlaybackDirective,
    DbxAudioVideoPlaybackGroupDirective,
    DbxImageHoverPreviewDirective,
    DbxGalleryComponent,
    DbxValueListItemModifierDirective,
    DbxListItemSingleSelectionModifierDirective,
    DbxButtonComponent,
    DbxDetailBlockComponent
  ],
  providers: [DbxListSingleSelectionStore],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DocExtensionAudioVideoComponent {
  readonly appPlaybackStore = inject(DbxAudioVideoPlaybackStore);
  readonly selectionStore = inject(DbxListSingleSelectionStore<DocGalleryItem>);
  readonly dbxWebFilePreviewService = inject(DbxWebFilePreviewService);

  readonly assetsPath = AUDIO_VIDEO_ASSETS_PATH;
  readonly tones = ['tone-a', 'tone-b', 'tone-c'];

  // MARK: Group
  readonly maxPlayingOptions = [1, 2, 3];
  readonly groupMaxPlaying = signal(1);
  readonly groupOverflowMode = signal<DbxAudioVideoPlaybackOverflowMode>('pause_oldest');

  toggleOverflowMode() {
    this.groupOverflowMode.update((x) => (x === 'pause_oldest' ? 'pause_newest' : 'pause_oldest'));
  }

  // MARK: Hover Preview
  readonly images = [1, 2, 3].map((x) => `${AUDIO_VIDEO_ASSETS_PATH}/image-${x}.jpg`);

  // MARK: Gallery
  private _nextColorIndex = 30;
  readonly galleryItems = signal<DocGalleryItem[]>(makeDocGalleryItems());
  readonly galleryStateSignal = computed(() => successResult(this.galleryItems()));
  readonly lastSelectionChange = signal<DbxListSingleSelectionChange<DocGalleryItem> | undefined>(undefined);

  readonly actionsData: DocGalleryActionsData = {
    onDelete: (item) => this.deleteItem(item),
    onLoad: (item) => this.loadItem(item)
  };

  readonly galleryConfig: DbxGalleryConfig<DocGalleryItem> = {
    keyForValue: (x) => x.id,
    presentation: (x) => {
      let config: DbxInjectionComponentConfig;

      switch (x.kind) {
        case 'color':
          config = { componentClass: DocGalleryColorPresentationComponent };
          break;
        case 'avatar':
          config = { componentClass: DocGalleryAvatarPresentationComponent };
          break;
        case 'clip':
          config = { componentClass: DocGalleryClipPresentationComponent };
          break;
        default:
          config = { componentClass: DbxGalleryImagePresentationComponent, data: { hoverPreview: x.kind === 'image', fit: 'cover' } };
          break;
      }

      return config;
    },
    top: { componentClass: DocGalleryLabelComponent },
    bottom: { componentClass: DocGalleryActionsComponent, data: this.actionsData }
  };

  onSelectionChange(change: DbxListSingleSelectionChange<DocGalleryItem>) {
    this.lastSelectionChange.set(change);
  }

  deleteItem(item: DocGalleryItem) {
    this.galleryItems.update((items) => items.filter((x) => x.id !== item.id));
    this.selectionStore.clearIfKey(item.id);
  }

  loadItem(item: DocGalleryItem) {
    this.selectionStore.selectEntry({ key: item.id, value: item });

    if ((item.kind === 'image' || item.kind === 'gif') && item.src) {
      this.dbxWebFilePreviewService.openPreviewDialog({
        srcUrl: new URL(item.src, window.location.href).href as WebsiteUrlWithPrefix,
        embedMimeType: item.kind === 'gif' ? 'image/gif' : 'image/jpeg'
      });
    }
  }

  addColors() {
    const offset = this._nextColorIndex;
    this._nextColorIndex += 10;
    this.galleryItems.update((items) => [...items, ...makeDocGalleryColorItems(10, offset)]);
  }

  resetGallery() {
    this._nextColorIndex = 30;
    this.galleryItems.set(makeDocGalleryItems());
    this.selectionStore.clear();
    this.lastSelectionChange.set(undefined);
  }
}
