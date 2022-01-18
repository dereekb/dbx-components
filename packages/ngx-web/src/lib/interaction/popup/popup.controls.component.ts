import { Component, ComponentFactoryResolver, Inject, Input, NgZone, Type, ViewChild, ViewContainerRef, OnInit, OnDestroy, ComponentRef } from '@angular/core';
import { DbNgxPopupController } from './popup.component';

/**
 * Popup Controls
 */
@Component({
  selector: 'dbx-popup-controls',
  template: `
  <div class="dbx-popup-controls">
    <span class="dbx-popup-controls-header">{{ header }}</span>
    <div class="spacer"></div>
    <dbx-popup-control-buttons></dbx-popup-control-buttons>
  </div>
  `,
  styleUrls: ['./popup.scss']
})
export class DbNgxPopupControlsComponent {

  @Input()
  header: string;

}
