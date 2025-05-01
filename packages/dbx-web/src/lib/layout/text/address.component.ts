import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { Maybe, UnitedStatesAddressWithContact } from '@dereekb/util';

// prettier-ignore
@Component({
  selector: 'dbx-us-address',
  template: `
    @if (address()) {
      @if (address()?.name) {
        <div class="addr-name">{{ address()?.name }}</div>
      }
      @if (address()?.phone) {
        <div class="addr-phone">{{ address()?.phone }}</div>
      }
      @if (address()?.line1) {
        <div class="addr-line1">{{ address()?.line1 }}</div>
      }
      @if (address()?.line2) {
        <div class="addr-line2">{{ address()?.line2 }}</div>
      }
      <div class="city-state-zip">
        <span class="addr-city">{{ address()?.city }}</span>
        @if (address()?.state || address()?.zip) {
          <span>, </span>
        }
        <span class="addr-state">{{ address()?.state }} </span>
        <span class="addr-zip">{{ address()?.zip }}</span>
      </div>
    }
  `,
  host: {
    class: 'dbx-us-address'
  },
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DbxUnitedStatesAddressComponent {

  readonly address = input<Maybe<Partial<UnitedStatesAddressWithContact>>>()

}
