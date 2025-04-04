import { GlobalPositionStrategy } from '@angular/cdk/overlay';

export type PopupPosition = 'center' | 'bottom_left' | 'bottom_right';

export interface PopupPositionOffset {
  readonly x?: string;
  readonly y?: string;
}

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
