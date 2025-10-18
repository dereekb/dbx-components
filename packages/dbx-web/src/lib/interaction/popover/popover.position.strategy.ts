import { type FlexibleConnectedPositionStrategy, type HorizontalConnectionPos, type Overlay, type VerticalConnectionPos } from '@angular/cdk/overlay';
import { type ElementRef } from '@angular/core';
import { type NgOverlayContainerConfiguration } from 'ng-overlay-container';

export interface PopoverPositionStrategyConfig {
  overlay: Overlay;
  elementRef: ElementRef;
  config: NgOverlayContainerConfiguration;
}

export class PopoverPositionStrategy {
  static make(overlay: Overlay, elementRef: ElementRef, config: NgOverlayContainerConfiguration): FlexibleConnectedPositionStrategy {
    const [originX, origin2ndX, origin3rdX]: HorizontalConnectionPos[] = config.originX === 'end' ? ['end', 'start', 'center'] : config.originX === 'start' ? ['start', 'end', 'center'] : ['center', 'start', 'end'];

    const overlayX = originX;
    const [overlayY, overlayFallbackY]: VerticalConnectionPos[] = config.overlayY === 'bottom' ? ['bottom', 'top'] : ['top', 'bottom'];

    const [originY, originFallbackY] = [overlayFallbackY, overlayY];
    const { offsetX = 0, offsetY = 0 } = config;

    return overlay
      .position()
      .flexibleConnectedTo(elementRef)
      .withLockedPosition(true)
      .withPositions([
        {
          originX,
          originY,
          overlayX,
          overlayY,
          offsetY
        },
        {
          originX: origin2ndX,
          originY,
          overlayX: origin2ndX,
          overlayY,
          offsetY
        },
        {
          originX,
          originY: originFallbackY,
          overlayX,
          overlayY: overlayFallbackY,
          offsetY: -offsetY
        },
        {
          originX: origin2ndX,
          originY: originFallbackY,
          overlayX: origin2ndX,
          overlayY: overlayFallbackY,
          offsetY: -offsetY
        },
        {
          originX: origin3rdX,
          originY,
          overlayX: origin3rdX,
          overlayY,
          offsetY
        },
        {
          originX: origin3rdX,
          originY: originFallbackY,
          overlayX: origin3rdX,
          overlayY: overlayFallbackY,
          offsetY: -offsetY
        }
      ])
      .withDefaultOffsetX(offsetX)
      .withDefaultOffsetY(offsetY);
  }
}
