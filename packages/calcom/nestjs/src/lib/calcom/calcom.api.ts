import { Inject, Injectable } from '@nestjs/common';
import { CalcomServiceConfig } from './calcom.config';
import { type Calcom, type CalcomServerContext, type CalcomUserContextFactoryInput, calcomFactory, getMe, getSchedules, getAvailableSlots, createBooking, getBooking, cancelBooking, getEventTypes, createEventType, updateEventType, deleteEventType, getCalendars, getBusyTimes, createWebhook, getWebhooks, getWebhook, updateWebhook, deleteWebhook } from '@dereekb/calcom';
import { CalcomOAuthApi } from '../oauth';

@Injectable()
export class CalcomApi {
  readonly calcom: Calcom;

  get calcomServerContext(): CalcomServerContext {
    return this.calcom.calcomServerContext;
  }

  constructor(
    @Inject(CalcomServiceConfig) readonly config: CalcomServiceConfig,
    @Inject(CalcomOAuthApi) readonly calcomOAuthApi: CalcomOAuthApi
  ) {
    this.calcom = calcomFactory({
      ...config.factoryConfig,
      oauthContext: calcomOAuthApi.oauthContext
    })(config.calcom);
  }

  // MARK: User Context
  makeUserContext(input: CalcomUserContextFactoryInput) {
    return this.calcom.calcomServerContext.makeUserContext(input);
  }

  // MARK: User
  get getMe() {
    return getMe(this.calcomServerContext);
  }

  // MARK: Schedules
  get getSchedules() {
    return getSchedules(this.calcomServerContext);
  }

  // MARK: Slots (public)
  get getAvailableSlots() {
    return getAvailableSlots(this.calcomServerContext.makePublicContext());
  }

  // MARK: Bookings
  get createBooking() {
    return createBooking(this.calcomServerContext);
  }

  get getBooking() {
    return getBooking(this.calcomServerContext);
  }

  get cancelBooking() {
    return cancelBooking(this.calcomServerContext);
  }

  // MARK: Event Types
  get getEventTypes() {
    return getEventTypes(this.calcomServerContext);
  }

  get createEventType() {
    return createEventType(this.calcomServerContext);
  }

  get updateEventType() {
    return updateEventType(this.calcomServerContext);
  }

  get deleteEventType() {
    return deleteEventType(this.calcomServerContext);
  }

  // MARK: Calendars
  get getCalendars() {
    return getCalendars(this.calcomServerContext);
  }

  get getBusyTimes() {
    return getBusyTimes(this.calcomServerContext);
  }

  // MARK: Webhooks
  get createWebhook() {
    return createWebhook(this.calcomServerContext);
  }

  get getWebhooks() {
    return getWebhooks(this.calcomServerContext);
  }

  get getWebhook() {
    return getWebhook(this.calcomServerContext);
  }

  get updateWebhook() {
    return updateWebhook(this.calcomServerContext);
  }

  get deleteWebhook() {
    return deleteWebhook(this.calcomServerContext);
  }
}
