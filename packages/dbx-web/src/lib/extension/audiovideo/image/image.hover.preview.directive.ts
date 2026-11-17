import { type ConnectedPosition, Overlay, type OverlayRef } from '@angular/cdk/overlay';
import { ComponentPortal } from '@angular/cdk/portal';
import { Directive, ElementRef, Injector, computed, inject, input } from '@angular/core';
import { clean } from '@dereekb/dbx-core';
import { type Maybe, type Milliseconds } from '@dereekb/util';
import { DBX_IMAGE_HOVER_PREVIEW_DATA, DbxImageHoverPreviewComponent, type DbxImageHoverPreviewData } from './image.hover.preview.component';

/**
 * Config for {@link DbxImageHoverPreviewDirective}.
 */
export interface DbxImageHoverPreviewConfig extends DbxImageHoverPreviewData {
  /**
   * Time to wait after the pointer enters before opening the preview. Defaults to {@link DEFAULT_DBX_IMAGE_HOVER_PREVIEW_OPEN_DELAY}.
   */
  readonly openDelay?: Maybe<Milliseconds>;
  /**
   * Time to wait after the pointer leaves before closing the preview. Defaults to 0.
   */
  readonly closeDelay?: Maybe<Milliseconds>;
  /**
   * Whether the preview is disabled.
   */
  readonly disabled?: Maybe<boolean>;
}

/**
 * Input accepted by {@link DbxImageHoverPreviewDirective}: an image url or a config.
 */
export type DbxImageHoverPreviewInput = string | DbxImageHoverPreviewConfig;

/**
 * Default time to wait after the pointer enters before opening the preview.
 */
export const DEFAULT_DBX_IMAGE_HOVER_PREVIEW_OPEN_DELAY: Milliseconds = 250;

/**
 * Positions tried for the preview panel, in order: right of the host, left, below, then above.
 */
export const DBX_IMAGE_HOVER_PREVIEW_POSITIONS: ConnectedPosition[] = [
  { originX: 'end', originY: 'center', overlayX: 'start', overlayY: 'center', offsetX: 8 },
  { originX: 'start', originY: 'center', overlayX: 'end', overlayY: 'center', offsetX: -8 },
  { originX: 'center', originY: 'bottom', overlayX: 'center', overlayY: 'top', offsetY: 8 },
  { originX: 'center', originY: 'top', overlayX: 'center', overlayY: 'bottom', offsetY: -8 }
];

/**
 * Shows a larger preview of an image in a floating panel while the pointer hovers over the host element.
 *
 * The panel is positioned next to the host and does not block the pointer, so it closes as soon as the pointer leaves the host.
 *
 * The panel opens after {@link DEFAULT_DBX_IMAGE_HOVER_PREVIEW_OPEN_DELAY} (250ms) so it does not flash while the pointer passes over;
 * set `openDelay: 0` to open it immediately. The image is limited to 480px by 480px (`DEFAULT_DBX_IMAGE_HOVER_PREVIEW_MAX_WIDTH` /
 * `DEFAULT_DBX_IMAGE_HOVER_PREVIEW_MAX_HEIGHT`) unless `maxWidth` / `maxHeight` are set.
 *
 * @dbxWebComponent
 * @dbxWebSlug image-hover-preview
 * @dbxWebCategory overlay
 * @dbxWebKind directive
 * @dbxWebRelated gallery
 * @dbxWebMinimalExample ```html
 * <img src="/assets/thumb.jpg" [dbxImageHoverPreview]="'/assets/full.jpg'" />
 * ```
 *
 * @example
 * ```html
 * <img [src]="thumbnailUrl" [dbxImageHoverPreview]="{ src: fullUrl, alt: 'Photo', maxWidth: '640px', openDelay: 500 }" />
 * ```
 */
@Directive({
  selector: '[dbxImageHoverPreview]',
  host: {
    '(mouseenter)': 'onMouseEnter()',
    '(mouseleave)': 'onMouseLeave()'
  },
  standalone: true
})
export class DbxImageHoverPreviewDirective {
  private readonly _overlay = inject(Overlay);
  private readonly _injector = inject(Injector);
  private readonly _elementRef = inject(ElementRef<HTMLElement>);

  readonly preview = input<Maybe<DbxImageHoverPreviewInput>>(undefined, { alias: 'dbxImageHoverPreview' });

  readonly configSignal = computed<Maybe<DbxImageHoverPreviewConfig>>(() => {
    const preview = this.preview();
    return typeof preview === 'string' ? { src: preview } : preview;
  });

  private _overlayRef: Maybe<OverlayRef>;
  private _timeout: Maybe<ReturnType<typeof setTimeout>>;

  constructor() {
    clean(() => {
      this._clearTimeout();
      this.close();
    });
  }

  onMouseEnter(): void {
    const config = this.configSignal();
    this._clearTimeout();

    if (config?.src && !config.disabled && !this._overlayRef) {
      this._timeout = setTimeout(() => this.open(), config.openDelay ?? DEFAULT_DBX_IMAGE_HOVER_PREVIEW_OPEN_DELAY);
    }
  }

  onMouseLeave(): void {
    const closeDelay = this.configSignal()?.closeDelay;
    this._clearTimeout();

    if (closeDelay) {
      this._timeout = setTimeout(() => this.close(), closeDelay);
    } else {
      this.close();
    }
  }

  /**
   * Opens the preview panel now.
   */
  open(): void {
    const config = this.configSignal();
    this._timeout = undefined;

    if (config?.src && !this._overlayRef) {
      const positionStrategy = this._overlay.position().flexibleConnectedTo(this._elementRef).withPositions(DBX_IMAGE_HOVER_PREVIEW_POSITIONS).withPush(true).withViewportMargin(8);

      const overlayRef = this._overlay.create({
        positionStrategy,
        scrollStrategy: this._overlay.scrollStrategies.reposition(),
        hasBackdrop: false,
        panelClass: 'dbx-image-hover-preview-panel'
      });

      const data: DbxImageHoverPreviewData = { src: config.src, alt: config.alt, maxWidth: config.maxWidth, maxHeight: config.maxHeight };
      const injector = Injector.create({ providers: [{ provide: DBX_IMAGE_HOVER_PREVIEW_DATA, useValue: data }], parent: this._injector });
      overlayRef.attach(new ComponentPortal(DbxImageHoverPreviewComponent, null, injector));
      this._overlayRef = overlayRef;
    }
  }

  /**
   * Closes the preview panel.
   */
  close(): void {
    this._overlayRef?.dispose();
    this._overlayRef = undefined;
  }

  private _clearTimeout(): void {
    if (this._timeout != null) {
      clearTimeout(this._timeout);
      this._timeout = undefined;
    }
  }
}
