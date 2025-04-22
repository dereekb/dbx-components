import { Component, ChangeDetectionStrategy, Directive } from '@angular/core';

/**
 * Component that wraps a card box and adds content padding.
 */
@Directive({
  selector: 'dbx-card-box-container, [dbxCardBoxContainer]',
  host: {
    class: 'd-block dbx-card-box-container'
  },
  standalone: true
})
export class DbxCardBoxContainerDirective {}
