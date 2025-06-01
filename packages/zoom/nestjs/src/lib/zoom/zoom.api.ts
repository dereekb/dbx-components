import { Inject, Injectable } from '@nestjs/common';
import { ZoomServiceConfig } from './zoom.config';
import { Zoom, ZoomServerContext, createMeetingForUser, deleteMeeting, getPastMeeting, getPastMeetingParticipants, getUser, listMeetingsForUser, listMeetingsForUserPageFactory, listUsers, listUsersPageFactory, zoomFactory } from '@dereekb/zoom';
import { ZoomOAuthApi } from '../oauth';

@Injectable()
export class ZoomApi {
  readonly zoom: Zoom;

  get zoomContext(): ZoomServerContext {
    return this.zoom.zoomServerContext;
  }

  get zoomRateLimiter() {
    return this.zoom.zoomServerContext.zoomRateLimiter;
  }

  constructor(
    @Inject(ZoomServiceConfig) readonly config: ZoomServiceConfig,
    @Inject(ZoomOAuthApi) readonly zoomOAuthApi: ZoomOAuthApi
  ) {
    this.zoom = zoomFactory({
      ...config.factoryConfig,
      oauthContext: zoomOAuthApi.oauthContext
    })(config.zoom);
  }

  // MARK: Users
  get getUser() {
    return getUser(this.zoomContext);
  }

  get listUsers() {
    return listUsers(this.zoomContext);
  }

  get listUsersPageFactory() {
    return listUsersPageFactory(this.zoomContext);
  }

  // MARK: Meetings
  get listMeetingsForUser() {
    return listMeetingsForUser(this.zoomContext);
  }

  get listMeetingsForUserPageFactory() {
    return listMeetingsForUserPageFactory(this.zoomContext);
  }

  get createMeetingForUser() {
    return createMeetingForUser(this.zoomContext);
  }

  get deleteMeeting() {
    return deleteMeeting(this.zoomContext);
  }

  // MARK: Past Meetings
  get getPastMeeting() {
    return getPastMeeting(this.zoomContext);
  }

  get getPastMeetingParticipants() {
    return getPastMeetingParticipants(this.zoomContext);
  }
}

export class ZoomApiUserContext {
  constructor(refreshToken: string) {
    // TODO: ...
  }
}
