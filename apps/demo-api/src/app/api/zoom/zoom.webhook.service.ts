import { catchAllHandlerKey } from '@dereekb/util';
import { Injectable, Logger } from '@nestjs/common';
import { UntypedZoomWebhookEvent, ZoomApi , ZoomWebhookService } from '@dereekb/zoom/nestjs';

@Injectable()
export class DemoApiZoomWebhookService {
  private readonly _zoomApi: ZoomApi;
  private readonly _zoomWebhookService: ZoomWebhookService;

  private readonly logger = new Logger('DemoApiZoomWebhookService');

  constructor(zoomApi: ZoomApi, zoomWebhookService: ZoomWebhookService) {
    this._zoomApi = zoomApi;
    this._zoomWebhookService = zoomWebhookService;

    zoomWebhookService.configure(this, (x) => {
      x.set(catchAllHandlerKey(), this.logHandledEvent);

      x.handleMeetingCreated(async (x) => {
        this.logger.log('Recieved zoom meeting created event successfully', {
          event: x.event,
          event_ts: x.event_ts,
          account: x.payload.account_id,
          object: x.payload.object
        });

        const fullMeetingDetails = await this.zoomApi.getMeeting({
          meetingId: x.payload.object.id
        });

        console.log('loaded full meeting details', {
          fullMeetingDetails
        });
      });

      x.handleMeetingUpdated((x) => {
        this.logger.log('Recieved zoom meeting updated event successfully', {
          event: x.event,
          event_ts: x.event_ts,
          account: x.payload.account_id,
          object: x.payload.object
        });
      });

      x.handleMeetingDeleted((x) => {
        this.logger.log('Recieved zoom meeting deleted event successfully', x);
      });
    });
  }

  get zoomApi() {
    return this._zoomApi;
  }

  get zoomWebhookService() {
    return this._zoomWebhookService;
  }

  logHandledEvent(event: UntypedZoomWebhookEvent): boolean {
    const handled: boolean = true;

    this.logger.log('Recieved zoom event successfully: ', event);

    return handled;
  }
}
