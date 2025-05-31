import { ZohoRecruitApi } from '@dereekb/zoho/nestjs';
import { ZoomApi } from '@dereekb/zoom/nestjs';
import { Inject, Injectable } from '@nestjs/common';

@Injectable()
export class DemoZoomService {
  private readonly _zoomApi: ZoomApi;

  constructor(@Inject(ZoomApi) zoomApi: ZoomApi) {
    this._zoomApi = zoomApi;
  }

  get zoomApi(): ZoomApi {
    return this._zoomApi;
  }
}

export interface DemoZoomServiceRef {
  readonly zoomService: DemoZoomService;
}
