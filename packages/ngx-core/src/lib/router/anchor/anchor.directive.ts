import { Directive } from '@angular/core';
import { Input } from '@angular/core';
import { Maybe } from '@dereekb/util';
import { ClickableAnchor } from './anchor';

export enum AnchorComponentType {
  None = 0,
  Clickable = 1,
  Sref = 2,
  Href = 3,
  Disabled = 4
}

/**
 * Abstract anchor directive.
 */
@Directive()
export class AbstractAnchorDirective<T extends ClickableAnchor = ClickableAnchor> {

  // TODO: Update to use observables

  private _type?: AnchorComponentType;
  private _disabled?: boolean;
  private _anchor: Maybe<T>;

  public get anchor(): Maybe<T> {
    return this._anchor;
  }

  @Input()
  public set anchor(anchor: Maybe<T>) {
    this._anchor = anchor;
    this._updateType();
  }

  public get disabled(): boolean | undefined {
    return this._disabled;
  }

  @Input()
  public set disabled(disabled: boolean | undefined) {
    if (this._disabled !== disabled) {
      this._disabled = disabled;
      this._updateType();
    }
  }

  public get type(): Maybe<AnchorComponentType> {
    return this._type;
  }

  /**
   * Updates the anchor's type.
   */
  private _updateType(): void {
    let type: AnchorComponentType = AnchorComponentType.Disabled;

    if (!this.disabled && this.anchor) {
      if (this.anchor.disabled) {
        type = AnchorComponentType.Disabled;
      } else if (this.anchor.ref) {
        type = AnchorComponentType.Sref;
      } else if (this.anchor.onClick) {
        type = AnchorComponentType.Clickable;
      } else if (this.anchor.url) {
        type = AnchorComponentType.Href;
      }
    }

    this._type = type;
  }

}
