import { ClickableFunction, ClickableUrl } from './clickable';
import { SegueRef } from '../segue';
import { Maybe } from '@dereekb/util';
import { Type, Provider } from '@angular/core';
import { Observable } from 'rxjs';

export interface ClickableAnchor extends ClickableFunction, ClickableUrl, SegueRef {
  disabled?: boolean;
}

export interface ClickableAnchorLink extends ClickableAnchor {
  title: string;
  icon?: string;
}

export interface ClickableIconAnchorLink extends Omit<ClickableAnchorLink, 'title'> {
  icon: string;
}

export enum AnchorType {
  None = 0,
  Clickable = 1,
  Sref = 2,
  Href = 3,
  Disabled = 4
}

export function anchorTypeForAnchor(anchor: Maybe<ClickableAnchor>, disabled?: Maybe<boolean>): AnchorType {
  let type: AnchorType = AnchorType.Disabled;

  if (!disabled && anchor) {
    if (anchor.disabled) {
      type = AnchorType.Disabled;
    } else if (anchor.ref) {
      type = AnchorType.Sref;
    } else if (anchor.onClick) {
      type = AnchorType.Clickable;
    } else if (anchor.url) {
      type = AnchorType.Href;
    }
  }

  return type;
}

export abstract class DbNgxAnchor<T extends ClickableAnchor = ClickableAnchor> {
  abstract disabled$: Observable<Maybe<boolean>>;
  abstract anchor$: Observable<Maybe<T>>;
  abstract disabled: Maybe<boolean>;
  abstract anchor: Maybe<T>;
  abstract type$: Observable<AnchorType>;
}

export function ProvideDbNgxAnchor<S extends DbNgxAnchor>(sourceType: Type<S>): Provider[] {
  return [{
    provide: DbNgxAnchor,
    useExisting: sourceType
  }];
}
