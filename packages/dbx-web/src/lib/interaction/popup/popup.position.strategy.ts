import { GlobalPositionStrategy } from '@angular/cdk/overlay';

/**
 * Predefined screen positions for a popup overlay.
 */
export type PopupPosition = 'center' | 'bottom_left' | 'bottom_right';

/**
 * X/Y offset for fine-tuning popup positioning.
 */
export interface PopupPositionOffset {
  readonly x?: string;
  readonly y?: string;
}

/**
 * Global position strategy for popups that supports named positions (center, bottom_left, bottom_right) with optional offsets.
 *
 * @example
 * ```ts
 * const strategy = new PopupGlobalPositionStrategy('bottom_right', { x: '16px', y: '16px' });
 * ```
 */
export class PopupGlobalPositionStrategy extends GlobalPositionStrategy {
  private _position!: PopupPosition;
  private _offset: PopupPositionOffset = {};

  constructor(position: PopupPosition = 'bottom_right', offset?: PopupPositionOffset) {
    super();
    this.setPopupPosition(position, offset);
  }

  setPopupOffset(offset?: PopupPositionOffset): void {
    this.setPopupPosition(this._position, offset ?? {});
  }

  setPopupPosition(position: PopupPosition, offset?: PopupPositionOffset): void {
    this._resetPositions();
    this._position = position;

    if (offset) {
      this._offset = offset;
    }

    const offsetX = this._offset.x ?? '0';
    const offsetY = this._offset.y ?? '0';

    switch (position) {
      case 'center':
        this.centerHorizontally();
        this.centerVertically();
        break;
      case 'bottom_left':
        this.bottom(offsetY);
        this.left(offsetX);
        break;
      case 'bottom_right':
        this.bottom(offsetY);
        this.right(offsetX);
        break;
    }
  }

  private _resetPositions(): void {
    this.top();
    this.bottom();
    this.left();
    this.right();
  }
}
