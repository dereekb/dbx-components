import { GlobalPositionStrategy } from '@angular/cdk/overlay';

export enum PopupPosition {
  CENTERED = 'centered',
  BOTTOM_LEFT = 'bottom_left',
  BOTTOM_RIGHT = 'bottom_right'
}

export interface PopupPositionOffset {
  x?: string;
  y?: string;
}

export class PopupGlobalPositionStrategy extends GlobalPositionStrategy {

  private _position: PopupPosition = PopupPosition.BOTTOM_RIGHT;
  private _offset: PopupPositionOffset = {};

  constructor(position = PopupPosition.BOTTOM_RIGHT, offset?: PopupPositionOffset) {
    super();
    this.setPopupPosition(position, offset);
  }

  setPopupOffset(offset?: PopupPositionOffset): void {
    this.setPopupPosition(this._position, offset ?? {});
  }

  setPopupPosition(position: PopupPosition, offset?: PopupPositionOffset): void {
    this._resetPositions();

    if (offset) {
      this._offset = offset;
    }

    const offsetX = this._offset.x ?? '0';
    const offsetY = this._offset.y ?? '0';

    switch (position) {
      case PopupPosition.CENTERED:
        break;
      case PopupPosition.BOTTOM_LEFT:
        this.bottom(offsetY);
        this.left(offsetX);
        break;
      case PopupPosition.BOTTOM_RIGHT:
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
