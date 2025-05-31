import { catchAllHandlerKey } from '@dereekb/util';
import { Injectable, Logger } from '@nestjs/common';
import Zoom from 'stripe';
import { ZoomApi } from '@dereekb/zoom/nestjs';
import { ZoomWebhookService } from '@dereekb/zoom/nestjs';

@Injectable()
export class DemoApiZoomWebhookService {
  private readonly _zoomApi: ZoomApi;
  private readonly _zoomWebhookService: ZoomWebhookService;

  private readonly logger = new Logger('DemoApiZoomWebhookService');

  constructor(zoomApi: ZoomApi, zoomWebhookService: ZoomWebhookService) {
    this._zoomApi = zoomApi;
    this._zoomWebhookService = zoomWebhookService;

    /*
    zoomWebhookService.configure(this, (x) => {
      x.set(catchAllHandlerKey(), this.logHandledEvent);
    });
    */
  }

  get zoomApi() {
    return this._zoomApi;
  }

  get zoomWebhookService() {
    return this._zoomWebhookService;
  }

  logHandledEvent(event: Zoom.Event): boolean {
    const handled: boolean = true;

    this.logger.log('Recieved zoom event successfully: ', event);

    return handled;
  }
}
