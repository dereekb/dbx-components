import { ClickableFunction, ClickableUrl } from './clickable';
import { SegueRef } from '../segue';

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
