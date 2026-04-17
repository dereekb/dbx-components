import { type FetchJsonInput, makeUrlSearchParams } from '@dereekb/util/fetch';
import { type ZohoDeskContext } from './desk.config';
import { type ZohoDeskDepartmentId } from './desk';
import { type ZohoDeskDepartment, type ZohoDeskDepartmentChatStatus } from './desk.department';
import { type ZohoDeskPageFilter, type ZohoDeskPageResult } from './desk.api.page';

// MARK: Utility
function zohoDeskDepartmentApiFetchJsonInput(method: string): FetchJsonInput {
  return { method };
}

// MARK: Get Departments
/**
 * Input parameters for listing departments via `GET /departments`.
 */
export interface ZohoDeskGetDepartmentsInput extends ZohoDeskPageFilter {
  readonly chatStatus?: ZohoDeskDepartmentChatStatus;
  readonly searchStr?: string;
  readonly isEnabled?: boolean;
}

/**
 * Response from listing departments.
 */
export type ZohoDeskGetDepartmentsResponse = ZohoDeskPageResult<ZohoDeskDepartment>;

/**
 * Function that retrieves a paginated list of departments.
 */
export type ZohoDeskGetDepartmentsFunction = (input: ZohoDeskGetDepartmentsInput) => Promise<ZohoDeskGetDepartmentsResponse>;

/**
 * Creates a {@link ZohoDeskGetDepartmentsFunction} bound to the given context.
 *
 * Retrieves a paginated list of departments from Zoho Desk, with optional filtering
 * by chat status, search string, and enabled state.
 *
 * @param context - Authenticated Zoho Desk context
 * @returns Function that retrieves paginated departments
 */
export function zohoDeskGetDepartments(context: ZohoDeskContext): ZohoDeskGetDepartmentsFunction {
  return (input: ZohoDeskGetDepartmentsInput) => {
    const params = makeUrlSearchParams([input]);
    return context.fetchJson<ZohoDeskGetDepartmentsResponse>(`/departments?${params}`, zohoDeskDepartmentApiFetchJsonInput('GET')).then((x) => x ?? { data: [] });
  };
}

// MARK: Get Department By ID
/**
 * Input parameters for retrieving a single department via `GET /departments/{departmentId}`.
 */
export interface ZohoDeskGetDepartmentByIdInput {
  readonly departmentId: ZohoDeskDepartmentId;
}

/**
 * Function that retrieves a single department by ID.
 */
export type ZohoDeskGetDepartmentByIdFunction = (input: ZohoDeskGetDepartmentByIdInput) => Promise<ZohoDeskDepartment>;

/**
 * Creates a {@link ZohoDeskGetDepartmentByIdFunction} bound to the given context.
 *
 * @param context - Authenticated Zoho Desk context
 * @returns Function that retrieves a single department
 */
export function zohoDeskGetDepartmentById(context: ZohoDeskContext): ZohoDeskGetDepartmentByIdFunction {
  return (input: ZohoDeskGetDepartmentByIdInput) => context.fetchJson<ZohoDeskDepartment>(`/departments/${input.departmentId}`, zohoDeskDepartmentApiFetchJsonInput('GET'));
}
