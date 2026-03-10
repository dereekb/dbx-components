import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { type ClickableAnchor } from '@dereekb/dbx-core';
import { type Maybe } from '@dereekb/util';
import { DbxAnchorComponent } from './anchor.component';

/**
 * Inline link component that wraps content in a {@link DbxAnchorComponent}. Accepts a router ref, an external href, or a full {@link ClickableAnchor} configuration.
 *
 * @example
 * ```html
 * <dbx-link ref="/home">Go Home</dbx-link>
 * <dbx-link href="https://example.com">External</dbx-link>
 * <dbx-link [anchor]="myAnchor">Custom Link</dbx-link>
 * ```
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
