import { Directive, ElementRef, HostListener, input, model } from '@angular/core';
import { Maybe } from '@dereekb/util';
import { AbstractDbxClipboardDirective } from '../../util/clipboard.directive';

@Directive({
  selector: '[dbxClickToCopyText]',
  host: {
    class: 'dbx-click-to-copy-text',
    '[class.dbx-click-to-copy-text-highlighted]': 'highlighted()'
  },
  standalone: true
})
export class DbxClickToCopyTextDirective extends AbstractDbxClipboardDirective {
  readonly copyTextFromElement = model<ElementRef<HTMLElement>>();

  /**
   * If the input is null, then copy from the element's text content.
   */
  readonly copyText = input<Maybe<string | null>>(undefined, { alias: 'dbxClickToCopyText' });

  /**
   * If true, the click events will be ignored.
   */
  readonly disableCopy = input<boolean>(false);

  /**
   * Highlight the text visually.
   */
  readonly highlighted = input<boolean>(true);

  @HostListener('click', ['$event'])
  public handleClick(event: MouseEvent): void {
    const disabled = this.disableCopy();

    if (!disabled) {
      event.preventDefault();
      event.stopPropagation();

      const eventElement = event.currentTarget as HTMLElement;
      this._copyText(eventElement);
    }
  }

  _copyText(eventElement?: Maybe<HTMLElement>): Maybe<string> {
    let copyText = this.copyText();

    // If the input is null, then copy from the element's text content.
    if (copyText !== null && !copyText) {
      const element = this.copyTextFromElement()?.nativeElement;
      copyText = (element ?? eventElement)?.textContent ?? undefined;
    }

    if (copyText) {
      this._copyToClipboard(copyText);
    }

    return copyText;
  }
}
