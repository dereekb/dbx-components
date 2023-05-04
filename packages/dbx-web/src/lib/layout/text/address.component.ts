import { Component, Input } from '@angular/core';
import { Maybe, UnitedStatesAddressWithContact } from '@dereekb/util';

@Component({
  selector: 'dbx-us-address',
  template: `
    <ng-container *ngIf="address">
      <div *ngIf="address.name" class="addr-name">{{ address.name }}</div>
      <div *ngIf="address.phone" class="addr-phone">{{ address.phone }}</div>
      <div *ngIf="address.line1" class="addr-line1">{{ address.line1 }}</div>
      <div *ngIf="address.line2" class="addr-line2">{{ address.line2 }}</div>
      <div class="city-state-zip">
        <span class="addr-city">{{ address.city }}</span>
        <span *ngIf="address.state || address.zip">,</span>
        <span class="addr-state">{{ address.state }}</span>
        <span class="addr-zip">{{ address.zip }}</span>
      </div>
    </ng-container>
  `,
  host: {
    class: 'dbx-us-address'
  }
})
export class DbxUnitedStatesAddressComponent {
  @Input()
  address: Maybe<Partial<UnitedStatesAddressWithContact>>;
}
