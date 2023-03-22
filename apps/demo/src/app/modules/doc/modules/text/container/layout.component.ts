import { ClickableAnchor } from '@dereekb/dbx-core';
import { TextChip } from '@dereekb/dbx-web';
import { Component } from '@angular/core';

@Component({
  templateUrl: './layout.component.html'
})
export class DocTextLayoutComponent {
  testAnchor: ClickableAnchor = {
    url: 'https://google.com'
  };

  lorem = `Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore
  et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip
  ex ea commodo consequat.`;

  linkify = `this feature is powered by https://linkify.js.org/`;

  chips: TextChip[] = [
    {
      text: 'a chip with a tool tip',
      tooltip: 'tooltip to show'
    },
    {
      text: 'b'
    },
    {
      text: 'c'
    }
  ];
}
