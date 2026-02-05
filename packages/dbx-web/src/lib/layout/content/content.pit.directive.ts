import { computed, Directive, input } from '@angular/core';
import { Pixels, PixelsString, type Maybe } from '@dereekb/util';

export type DbxContentPitScrollableInput = boolean | DbxContentPitScrollableHeight;
export type DbxContentPitScrollableHeight = Pixels | PixelsString | DbxContentPitScrollableHeightSetting;
export type DbxContentPitScrollableHeightSetting = 'small' | 'medium' | 'large';

/**
 * Component used to wrap content in a pit with a label.
 */
@Directive({
  selector: 'dbx-content-pit, [dbxContentPit]',
  host: {
    class: 'd-block dbx-content-pit',
    '[class.dbx-content-pit-scrollable]': 'scrollableHeightSignal() != null',
    '[class.dbx-content-pit-rounded]': 'rounded()',
    '[style.max-height]': 'scrollableHeightSignal()'
  },
  standalone: true
})
export class DbxContentPitDirective {
  readonly scrollable = input<Maybe<DbxContentPitScrollableInput>>();
  readonly rounded = input<boolean>(false);

  readonly scrollableHeightSignal = computed(() => {
    let scrollable = this.scrollable();
    let scrollableHeight: PixelsString | undefined;

    if (typeof scrollable === 'boolean') {
      scrollable = scrollable ? 'medium' : undefined; // defaults to medium
    }

    if (scrollable) {
      if (typeof scrollable === 'string') {
        switch (scrollable) {
          case 'small':
            scrollable = 120;
            break;
          case 'medium':
            scrollable = 320;
            break;
          case 'large':
            scrollable = 460;
            break;
          default:
            scrollableHeight = scrollable; // use as-is
            break;
        }
      }

      if (typeof scrollable === 'number') {
        scrollableHeight = `${scrollable}px`;
      }
    }

    return scrollableHeight ?? null;
  });
}
