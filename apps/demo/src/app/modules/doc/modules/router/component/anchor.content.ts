import { Component } from '@angular/core';
import { randomNumber } from '@dereekb/util';

@Component({
  template: `
    <span style="display: block;">
      <span class="dbx-primary">Random Value</span>
      :
      <span class="dbx-primary">{{ value }}</span>
    </span>
  `
})
export class DocRouterCustomAnchorContentComponent {
  readonly value = randomNumber(100);
}
