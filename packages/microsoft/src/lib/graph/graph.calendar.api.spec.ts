import { describe, expect, it } from 'vitest';
import { type FetchHandler } from '@dereekb/util/fetch';
import { microsoftGraphFactory } from './graph.factory';
import { createEvent, getEvent, listCalendarView, microsoftGraphCancelEventRequest, microsoftGraphCreateEventRequest, microsoftGraphEventCancellationRecipientCount } from './graph.calendar.api';
import { getAutomaticRepliesSetting, microsoftGraphAutomaticRepliesSettingFields, microsoftGraphUpdateAutomaticRepliesRequest, updateAutomaticRepliesSetting } from './graph.mailbox.settings.api';

function recordingGraph(answer: (request: Request) => Response) {
  const requests: Request[] = [];
  const fetchHandler: FetchHandler = async (request) => {
    requests.push(request.clone());
    return answer(request);
  };

  const { graphContext } = microsoftGraphFactory({ fetchHandler })({ accessTokenGetter: () => 'token' });
  return { graphContext, requests };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(body == null ? null : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

describe('calendar', () => {
  it('sends the outlook.timezone Prefer on calendarView, get and create when a time zone is set', async () => {
    const graph = recordingGraph(() => jsonResponse({ id: 'e1', value: [] }));

    await listCalendarView(graph.graphContext)({ start: '2026-11-16T00:00:00Z', end: '2026-11-17T00:00:00Z', timeZone: 'Pacific Standard Time', select: 'id,subject' });
    await getEvent(graph.graphContext)({ id: 'e1', timeZone: 'Pacific Standard Time' });
    await createEvent(graph.graphContext)({ subject: 'Focus', start: { dateTime: '2026-11-16T09:00:00', timeZone: 'UTC' }, end: { dateTime: '2026-11-16T10:00:00', timeZone: 'UTC' }, timeZone: 'Pacific Standard Time' });
    await listCalendarView(graph.graphContext)({ start: '2026-11-16T00:00:00Z', end: '2026-11-17T00:00:00Z' });

    graph.requests.slice(0, 3).forEach((request) => expect(request.headers.get('Prefer')).toBe('outlook.timezone="Pacific Standard Time"'));
    expect(graph.requests[3].headers.get('Prefer')).toBeNull();
    expect(new URL(graph.requests[0].url).searchParams.get('$select')).toBe('id,subject');
    expect(new URL(graph.requests[3].url).searchParams.get('$select')).toContain('organizer');
  });

  it('creates an event with required attendees, a Teams link and showAs', () => {
    // models: M-q (user-post-events) — attendees always get invitations
    const request = microsoftGraphCreateEventRequest({
      subject: 'Sync',
      start: { dateTime: '2026-11-16T09:00:00', timeZone: 'Pacific Standard Time' },
      end: { dateTime: '2026-11-16T09:30:00', timeZone: 'Pacific Standard Time' },
      attendees: ['ada@example.com'],
      location: 'Room 1',
      onlineMeeting: true,
      showAs: 'free',
      reminder: false
    });

    expect(request).toEqual({
      method: 'POST',
      path: '/me/events',
      headers: undefined,
      body: {
        subject: 'Sync',
        start: { dateTime: '2026-11-16T09:00:00', timeZone: 'Pacific Standard Time' },
        end: { dateTime: '2026-11-16T09:30:00', timeZone: 'Pacific Standard Time' },
        attendees: [{ emailAddress: { address: 'ada@example.com' }, type: 'required' }],
        location: { displayName: 'Room 1' },
        isOnlineMeeting: true,
        onlineMeetingProvider: 'teamsForBusiness',
        showAs: 'free',
        isReminderOn: false
      }
    });
  });

  it('counts cancellation recipients only for a meeting the user organizes', () => {
    // models: M-q (event-delete) — deleting on the organizer's calendar sends cancellations
    const attendees = [{ emailAddress: { address: 'ada@example.com' } }, { emailAddress: { address: 'bob@example.com' } }];
    expect(microsoftGraphEventCancellationRecipientCount({ isOrganizer: true, attendees })).toBe(2);
    expect(microsoftGraphEventCancellationRecipientCount({ isOrganizer: false, attendees })).toBe(0);
    expect(microsoftGraphEventCancellationRecipientCount({ isOrganizer: true, attendees: [] })).toBe(0);
  });

  it('posts the cancel comment to /cancel', () => {
    expect(microsoftGraphCancelEventRequest({ id: 'e/1', comment: 'Moved' })).toEqual({ method: 'POST', path: '/me/events/e%2F1/cancel', body: { comment: 'Moved' } });
  });
});

describe('automatic replies', () => {
  it('PATCHes mailboxSettings with only the automaticRepliesSetting fields that are set', () => {
    // models: https://learn.microsoft.com/en-us/graph/api/resources/automaticrepliessetting
    const request = microsoftGraphUpdateAutomaticRepliesRequest({
      status: 'scheduled',
      externalAudience: 'none',
      scheduledStartDateTime: { dateTime: '2030-01-01T00:00:00', timeZone: 'UTC' },
      scheduledEndDateTime: { dateTime: '2030-01-02T00:00:00', timeZone: 'UTC' },
      internalReplyMessage: '<p>Away</p>',
      externalReplyMessage: null
    });

    expect(request).toEqual({
      method: 'PATCH',
      path: '/me/mailboxSettings',
      body: {
        automaticRepliesSetting: {
          status: 'scheduled',
          externalAudience: 'none',
          scheduledStartDateTime: { dateTime: '2030-01-01T00:00:00', timeZone: 'UTC' },
          scheduledEndDateTime: { dateTime: '2030-01-02T00:00:00', timeZone: 'UTC' },
          internalReplyMessage: '<p>Away</p>'
        }
      }
    });
  });

  it('drops @odata.context from a read setting so it can be PATCHed back unchanged', async () => {
    // models: user-get-mailboxsettings — GET .../automaticRepliesSetting carries @odata.context
    const read = { '@odata.context': 'https://graph.microsoft.com/v1.0/$metadata#users(...)/mailboxSettings/automaticRepliesSetting', status: 'disabled', externalAudience: 'all', internalReplyMessage: '', externalReplyMessage: '' };
    const graph = recordingGraph((request) => (request.method === 'GET' ? jsonResponse(read) : jsonResponse({ automaticRepliesSetting: { status: 'disabled' } })));

    const setting = await getAutomaticRepliesSetting(graph.graphContext)();
    const updated = await updateAutomaticRepliesSetting(graph.graphContext)(setting);

    expect(microsoftGraphAutomaticRepliesSettingFields(setting)).toEqual({ status: 'disabled', externalAudience: 'all', internalReplyMessage: '', externalReplyMessage: '' });
    expect(await graph.requests[1].json()).toEqual({ automaticRepliesSetting: { status: 'disabled', externalAudience: 'all', internalReplyMessage: '', externalReplyMessage: '' } });
    expect(updated).toEqual({ status: 'disabled' });
  });
});
