import { type Maybe, type ArrayOrValue, asArray, joinStringsWithCommas } from '@dereekb/util';
import { type FetchJsonInput, type FetchPage, type FetchPageFactoryOptions, makeUrlSearchParams } from '@dereekb/util/fetch';
import { type ZohoDeskContext } from './desk.config';
import { type ZohoDeskAgentId, type ZohoDeskDepartmentId } from './desk';
import { type ZohoDeskAgent, type ZohoDeskAgentInclude, type ZohoDeskAgentStatus } from './desk.agent';
import { type ZohoDeskPageFilter, type ZohoDeskPageResult, zohoDeskFetchPageFactory } from './desk.api.page';

// MARK: Utility
function zohoDeskAgentApiFetchJsonInput(method: string): FetchJsonInput {
  return { method };
}

function joinAgentInclude(include: Maybe<ArrayOrValue<string>>): Maybe<string> {
  let result: Maybe<string>;

  if (include) {
    result = joinStringsWithCommas(asArray(include));
  }

  return result;
}

// MARK: List Agents
/**
 * Input parameters for listing agents via `GET /agents`.
 */
export interface ZohoDeskGetAgentsInput extends ZohoDeskPageFilter {
  readonly include?: ArrayOrValue<ZohoDeskAgentInclude>;
  readonly departmentId?: ZohoDeskDepartmentId;
  readonly status?: ZohoDeskAgentStatus;
}

/**
 * Response from listing agents.
 */
export type ZohoDeskGetAgentsResponse = ZohoDeskPageResult<ZohoDeskAgent>;

/**
 * Function that retrieves a paginated list of agents.
 */
export type ZohoDeskGetAgentsFunction = (input: ZohoDeskGetAgentsInput) => Promise<ZohoDeskGetAgentsResponse>;

/**
 * Creates a {@link ZohoDeskGetAgentsFunction} bound to the given context.
 *
 * Retrieves a paginated list of agents, with optional filtering by department and status,
 * and inline expansion of related entities (role, profile, departments).
 *
 * @param context - Authenticated Zoho Desk context
 * @returns Function that retrieves paginated agents
 */
export function zohoDeskGetAgents(context: ZohoDeskContext): ZohoDeskGetAgentsFunction {
  return (input: ZohoDeskGetAgentsInput) => {
    const { include, ...rest } = input;
    const params = makeUrlSearchParams([{ ...rest, include: joinAgentInclude(include) }]);
    return context.fetchJson<ZohoDeskGetAgentsResponse>(`/agents?${params}`, zohoDeskAgentApiFetchJsonInput('GET')).then((x) => x ?? { data: [] });
  };
}

// MARK: Get Agent By ID
/**
 * Input parameters for retrieving a single agent via `GET /agents/{agentId}`.
 */
export interface ZohoDeskGetAgentByIdInput {
  readonly agentId: ZohoDeskAgentId;
  readonly include?: ArrayOrValue<ZohoDeskAgentInclude>;
}

/**
 * Function that retrieves a single agent by ID.
 */
export type ZohoDeskGetAgentByIdFunction = (input: ZohoDeskGetAgentByIdInput) => Promise<ZohoDeskAgent>;

/**
 * Creates a {@link ZohoDeskGetAgentByIdFunction} bound to the given context.
 *
 * @param context - Authenticated Zoho Desk context
 * @returns Function that retrieves a single agent
 */
export function zohoDeskGetAgentById(context: ZohoDeskContext): ZohoDeskGetAgentByIdFunction {
  return (input: ZohoDeskGetAgentByIdInput) => {
    const { agentId, include } = input;
    const params = makeUrlSearchParams([{ include: joinAgentInclude(include) }]);
    const queryString = params.toString();
    return context.fetchJson<ZohoDeskAgent>(`/agents/${agentId}${queryString ? `?${queryString}` : ''}`, zohoDeskAgentApiFetchJsonInput('GET'));
  };
}

// MARK: Get Agents By IDs
/**
 * Input parameters for retrieving multiple agents by their IDs via `GET /agentsByIds`.
 */
export interface ZohoDeskGetAgentsByIdsInput {
  readonly agentIds: ArrayOrValue<ZohoDeskAgentId>;
}

/**
 * Function that retrieves multiple agents by their IDs.
 */
export type ZohoDeskGetAgentsByIdsFunction = (input: ZohoDeskGetAgentsByIdsInput) => Promise<ZohoDeskAgent[]>;

/**
 * Creates a {@link ZohoDeskGetAgentsByIdsFunction} bound to the given context.
 *
 * @param context - Authenticated Zoho Desk context
 * @returns Function that retrieves agents by IDs
 */
export function zohoDeskGetAgentsByIds(context: ZohoDeskContext): ZohoDeskGetAgentsByIdsFunction {
  return (input: ZohoDeskGetAgentsByIdsInput) => {
    const params = makeUrlSearchParams([{ agentIds: joinStringsWithCommas(asArray(input.agentIds)) }]);
    return context.fetchJson<ZohoDeskPageResult<ZohoDeskAgent>>(`/agentsByIds?${params}`, zohoDeskAgentApiFetchJsonInput('GET')).then((x) => x?.data ?? []);
  };
}

// MARK: Get My Info
/**
 * Function that retrieves the current authenticated agent's profile.
 */
export type ZohoDeskGetMyInfoFunction = () => Promise<ZohoDeskAgent>;

/**
 * Creates a {@link ZohoDeskGetMyInfoFunction} bound to the given context.
 *
 * Retrieves the profile of the agent associated with the current OAuth token.
 *
 * @param context - Authenticated Zoho Desk context
 * @returns Function that retrieves the current agent's info
 */
export function zohoDeskGetMyInfo(context: ZohoDeskContext): ZohoDeskGetMyInfoFunction {
  return () => context.fetchJson<ZohoDeskAgent>('/myinfo', zohoDeskAgentApiFetchJsonInput('GET'));
}

// MARK: Page Factory
/**
 * Factory that creates paginated iterators for agent list queries.
 */
export type ZohoDeskGetAgentsPageFactory = (input: ZohoDeskGetAgentsInput, options?: Maybe<FetchPageFactoryOptions<ZohoDeskGetAgentsInput, ZohoDeskGetAgentsResponse>>) => FetchPage<ZohoDeskGetAgentsInput, ZohoDeskGetAgentsResponse>;

/**
 * Creates a {@link ZohoDeskGetAgentsPageFactory} bound to the given context.
 *
 * @param context - Authenticated Zoho Desk context
 * @returns Page factory for iterating over agent results
 */
export function zohoDeskGetAgentsPageFactory(context: ZohoDeskContext): ZohoDeskGetAgentsPageFactory {
  return zohoDeskFetchPageFactory(zohoDeskGetAgents(context));
}
