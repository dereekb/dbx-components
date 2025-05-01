import { ChangeDetectionStrategy, Component, computed, input, Input } from '@angular/core';
import { ClickableAnchor } from '@dereekb/dbx-core';
import { type Maybe } from '@dereekb/util';
import { DbxAnchorComponent } from './anchor.component';

/**
 * Pre-styled text that can link to either a website or a ref using a dbx-anchor.
 */
@Component({
  selector: 'dbx-link',
  standalone: true,
  imports: [DbxAnchorComponent],
  template: `
    <dbx-anchor [anchor]="anchorSignal()">
      <ng-content></ng-content>
    </dbx-anchor>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'd-inline dbx-link'
  }
})
export class DbxLinkComponent {
  readonly ref = input<Maybe<string>>();
  readonly href = input<Maybe<string>>();
  readonly anchor = input<Maybe<ClickableAnchor>>();

  readonly anchorSignal = computed(() => {
    const ref = this.ref();
    const href = this.href();
    let anchor = this.anchor();

    if (!anchor) {
      if (ref) {
        anchor = {
          ref
        };
      } else if (href) {
        anchor = {
          url: href
        };
      }
    }

    return anchor;
  });
}
