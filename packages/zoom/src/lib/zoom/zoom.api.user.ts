import { FetchPageFactory, makeUrlSearchParams } from '@dereekb/util/fetch';
import { mapToZoomPageResult, zoomFetchPageFactory, ZoomPageFilter, ZoomPageResult } from '../zoom.api.page';
import { ZoomUser, ZoomUserRoleId, ZoomUserStatus } from './zoom.api.user.type';
import { ZoomContext } from './zoom.config';
import { ZoomUserId } from '../zoom.type';

// MARK: Get User
export interface GetUserInput {
  readonly userId: ZoomUserId;
}

export type GetUserResponse = ZoomUser;

export type GetUserFunction = (input: GetUserInput) => Promise<GetUserResponse>;

/**
 * https://developers.zoom.us/docs/api/users/#tag/users/GET/users/{userId}
 *
 * @param context
 * @returns
 */
export function getUser(context: ZoomContext): GetUserFunction {
  return (input) => context.fetchJson(`/users/${input.userId}`, 'GET');
}

// MARK: List Users
export interface ListUsersInput extends ZoomPageFilter {
  readonly status?: ZoomUserStatus;
  readonly role_id?: ZoomUserRoleId;
}

export type ListUsersResponse = ZoomPageResult<ZoomUser>;

export type ListUsersFunction = (input?: ListUsersInput) => Promise<ListUsersResponse>;

/**
 * https://developers.zoom.us/docs/api/users/#tag/users/GET/users
 *
 * @param context
 * @returns
 */
export function listUsers(context: ZoomContext): ListUsersFunction {
  return (input) => context.fetchJson(`/users?${makeUrlSearchParams(input)}`, 'GET').then(mapToZoomPageResult('users'));
}

export type ListUsersPageFactory = FetchPageFactory<ListUsersInput, ListUsersResponse>;

export function listUsersPageFactory(context: ZoomContext): ListUsersPageFactory {
  return zoomFetchPageFactory(listUsers(context));
}
