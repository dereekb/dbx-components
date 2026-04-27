/**
 * Shared MCP tool-wrapper factories for the per-domain folder validators.
 *
 * Each per-domain wrapper (`*-validate-folder.tool.ts`) ran the same
 * pipeline — parse args, resolve cwd-bounded paths, build inspections,
 * validate, format — varying only the domain-specific inspect / validate /
 * format functions and the tool definition. This module centralises that
 * pipeline so the wrappers shrink to a single factory call.
 */

import { resolve } from 'node:path';
import { type Tool } from '@modelcontextprotocol/sdk/types.js';
import { type } from 'arktype';
import { toolError, type DbxTool, type ToolResult } from './types.js';
import { ensurePathInsideCwd, resolveFolderPaths, resolveValidatorSources, type ValidatorSource } from './validate-input.js';

// MARK: paths + glob input shape

const FolderValidateArgsType = type({
  'paths?': 'string[]',
  'glob?': 'string'
});

/**
 * Domain-specific hooks needed to build a `paths?`/`glob?` folder validator
 * tool. The factory owns argument parsing, cwd-bounded path resolution, the
 * per-folder inspection loop, and the `ToolResult` shape; each domain only
 * supplies its inspection / validation / formatting logic.
 */
export interface CreateFolderValidateToolConfig<TInspection extends { readonly path: string }, TResult extends { readonly errorCount: number }> {
  /**
   * MCP tool definition (name, description, inputSchema).
   */
  readonly definition: Tool;
  /**
   * Inspects a single folder at the absolute path. The factory relativizes
   * the returned inspection's `path` to the caller-supplied relative path
   * before validation.
   */
  inspectFolder(absolutePath: string): Promise<TInspection>;
  /**
   * Pure validator that runs the domain rules over the prepared inspections.
   */
  validate(inspections: readonly TInspection[]): TResult;
  /**
   * Renders the markdown report shown to the caller.
   */
  format(result: TResult): string;
}

/**
 * Builds an MCP tool that validates one or more folders. Accepts
 * `paths?` + `glob?` (at least one required), resolves them against
 * `process.cwd()` (rejecting paths that escape the cwd), runs the
 * domain-supplied `inspectFolder` per match, and threads the
 * inspections through `validate` and `format`.
 *
 * Used by `dbx_model_validate_folder` and `dbx_system_m_validate_folder`.
 *
 * @param config - the domain-specific hooks and tool definition
 * @returns the registered {@link DbxTool}
 */
export function createFolderValidateTool<TInspection extends { readonly path: string }, TResult extends { readonly errorCount: number }>(config: CreateFolderValidateToolConfig<TInspection, TResult>): DbxTool {
  const { definition, inspectFolder, validate, format } = config;

  async function run(rawArgs: unknown): Promise<ToolResult> {
    const parsed = FolderValidateArgsType(rawArgs);
    if (parsed instanceof type.errors) {
      return toolError(`Invalid arguments: ${parsed.summary}`);
    }

    const hasAny = (parsed.paths && parsed.paths.length > 0) || parsed.glob;
    if (!hasAny) {
      return toolError('Must provide at least one of `paths` or `glob`.');
    }

    const cwd = process.cwd();
    let paths: readonly string[];
    try {
      paths = await resolveFolderPaths({ paths: parsed.paths, glob: parsed.glob, cwd });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return toolError(`Failed to resolve folder paths: ${message}`);
    }

    if (paths.length === 0) {
      return toolError('No matching folders found.');
    }

    const inspections: TInspection[] = [];
    try {
      for (const relative of paths) {
        const absolute = resolve(cwd, relative);
        const inspection = await inspectFolder(absolute);
        const relativized = { ...inspection, path: relative };
        inspections.push(relativized);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return toolError(`Failed to read folders: ${message}`);
    }

    const result = validate(inspections);
    const text = format(result);
    const toolResult: ToolResult = {
      content: [{ type: 'text', text }],
      isError: result.errorCount > 0
    };
    return toolResult;
  }

  const tool: DbxTool = { definition, run };
  return tool;
}

// MARK: sources + paths + glob input shape

const SourceValidateArgsType = type({
  'sources?': type({ name: 'string', text: 'string' }).array(),
  'paths?': 'string[]',
  'glob?': 'string'
});

/**
 * Domain-specific hooks needed to build a `sources?` + `paths?` + `glob?`
 * source-text validator tool. The factory owns argument parsing,
 * cwd-bounded source resolution (read-as-utf8 for paths and glob matches,
 * passthrough for inline sources, dedup by name), and the `ToolResult`
 * shape; each domain only supplies its validation and formatting logic.
 */
export interface CreateSourceValidateToolConfig<TResult extends { readonly errorCount: number }> {
  /**
   * MCP tool definition (name, description, inputSchema).
   */
  readonly definition: Tool;
  /**
   * Pure validator that runs the domain rules over the prepared sources.
   */
  validate(sources: readonly ValidatorSource[]): TResult;
  /**
   * Renders the markdown report shown to the caller.
   */
  format(result: TResult): string;
}

/**
 * Builds an MCP tool that validates one or more source files. Accepts
 * `sources?` + `paths?` + `glob?` (at least one required), reads `paths` /
 * `glob` matches off disk against `process.cwd()` (rejecting paths that
 * escape the cwd), dedupes by source name, and threads the resolved
 * sources through `validate` and `format`.
 *
 * Used by `dbx_model_validate` and `dbx_model_validate_api`.
 *
 * @param config - the domain-specific hooks and tool definition
 * @returns the registered {@link DbxTool}
 */
export function createSourceValidateTool<TResult extends { readonly errorCount: number }>(config: CreateSourceValidateToolConfig<TResult>): DbxTool {
  const { definition, validate, format } = config;

  async function run(rawArgs: unknown): Promise<ToolResult> {
    const parsed = SourceValidateArgsType(rawArgs);
    if (parsed instanceof type.errors) {
      return toolError(`Invalid arguments: ${parsed.summary}`);
    }

    const hasAny = (parsed.sources && parsed.sources.length > 0) || (parsed.paths && parsed.paths.length > 0) || parsed.glob;
    if (!hasAny) {
      return toolError('Must provide at least one of `sources`, `paths`, or `glob`.');
    }

    let sources: readonly ValidatorSource[];
    try {
      sources = await resolveValidatorSources({ sources: parsed.sources, paths: parsed.paths, glob: parsed.glob, cwd: process.cwd() });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return toolError(`Failed to read sources: ${message}`);
    }

    if (sources.length === 0) {
      return toolError('No matching source files found.');
    }

    const result = validate(sources);
    const text = format(result);
    const toolResult: ToolResult = {
      content: [{ type: 'text', text }],
      isError: result.errorCount > 0
    };
    return toolResult;
  }

  const tool: DbxTool = { definition, run };
  return tool;
}

// MARK: componentDir + apiDir input shape

const TwoSideValidateArgsType = type({
  componentDir: 'string',
  apiDir: 'string'
});

/**
 * Resolved component / api paths supplied to {@link CreateTwoSideValidateToolConfig.inspectAndValidate}.
 * Both absolute and relative forms are provided so the domain can hand the
 * absolute path to its file-system inspection and the relative path to its
 * formatter.
 */
export interface TwoSideInspectAndValidateInput {
  /**
   * Absolute path to the component package root.
   */
  readonly componentAbs: string;
  /**
   * Caller-supplied relative path to the component package root.
   */
  readonly componentRel: string;
  /**
   * Absolute path to the API app root.
   */
  readonly apiAbs: string;
  /**
   * Caller-supplied relative path to the API app root.
   */
  readonly apiRel: string;
}

/**
 * Domain-specific hooks needed to build a `componentDir` / `apiDir` validator
 * tool. The factory owns argument parsing, the cwd-bounded path guard, error
 * wrapping, and the `ToolResult` shape; each domain only supplies the
 * inspect+validate pipeline and the formatter.
 */
export interface CreateTwoSideValidateToolConfig<TResult extends { readonly errorCount: number }> {
  /**
   * MCP tool definition (name, description, inputSchema).
   */
  readonly definition: Tool;
  /**
   * Runs the domain inspection and validation. Receives the resolved
   * absolute and relative paths for both sides; returns the validation
   * result the formatter consumes.
   */
  inspectAndValidate(input: TwoSideInspectAndValidateInput): Promise<TResult>;
  /**
   * Renders the markdown report shown to the caller.
   */
  format(result: TResult): string;
}

/**
 * Resolves the parsed `componentDir` / `apiDir` pair into the absolute /
 * relative quad consumed by both the two-side validator and list-app
 * factories. Returns the resolved input or a {@link toolError} payload
 * when either path escapes `cwd`.
 *
 * @param parsed - the parsed-args envelope
 * @param parsed.componentDir - the relative path to the component package root
 * @param parsed.apiDir - the relative path to the API app root
 * @returns the absolute + relative quad, or an error `ToolResult`
 */
function resolveTwoSideInput(parsed: { readonly componentDir: string; readonly apiDir: string }): TwoSideInspectAndValidateInput | ToolResult {
  const cwd = process.cwd();
  const componentRel = parsed.componentDir;
  const apiRel = parsed.apiDir;
  try {
    ensurePathInsideCwd(componentRel, cwd);
    ensurePathInsideCwd(apiRel, cwd);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return toolError(message);
  }
  return {
    componentAbs: resolve(cwd, componentRel),
    componentRel,
    apiAbs: resolve(cwd, apiRel),
    apiRel
  };
}

/**
 * Builds an MCP tool that validates a component / API directory pair. Accepts
 * required `componentDir` + `apiDir`, resolves them against `process.cwd()`
 * (rejecting paths that escape the cwd), and threads the resolved paths
 * through the domain-supplied `inspectAndValidate` and `format`.
 *
 * Used by `dbx_notification_m_validate_folder`, `dbx_notification_m_validate_app`,
 * `dbx_storagefile_m_validate_folder`, and `dbx_storagefile_m_validate_app`.
 *
 * @param config - the domain-specific hooks and tool definition
 * @returns the registered {@link DbxTool}
 */
export function createTwoSideValidateTool<TResult extends { readonly errorCount: number }>(config: CreateTwoSideValidateToolConfig<TResult>): DbxTool {
  const { definition, inspectAndValidate, format } = config;

  async function run(rawArgs: unknown): Promise<ToolResult> {
    const parsed = TwoSideValidateArgsType(rawArgs);
    if (parsed instanceof type.errors) {
      return toolError(`Invalid arguments: ${parsed.summary}`);
    }

    const resolved = resolveTwoSideInput(parsed);
    if ('content' in resolved) {
      return resolved;
    }

    const result = await inspectAndValidate(resolved);
    const text = format(result);
    const toolResult: ToolResult = {
      content: [{ type: 'text', text }],
      isError: result.errorCount > 0
    };
    return toolResult;
  }

  const tool: DbxTool = { definition, run };
  return tool;
}

// MARK: componentDir + apiDir + format input shape (list-app)

const ListAppArgsType = type({
  componentDir: 'string',
  apiDir: 'string',
  'format?': "'markdown' | 'json'"
});

/**
 * Domain-specific hooks needed to build a `componentDir` / `apiDir` /
 * `format?` list-app tool. The factory owns argument parsing, the
 * cwd-bounded path guard, format dispatch, and the `ToolResult` shape;
 * each domain only supplies the inspect+list pipeline and the two
 * formatters.
 */
export interface CreateListAppToolConfig<TReport> {
  /**
   * MCP tool definition (name, description, inputSchema).
   */
  readonly definition: Tool;
  /**
   * Runs the domain inspection and listing. Receives the resolved
   * absolute and relative paths for both sides; returns the report
   * the formatters consume.
   */
  inspectAndList(input: TwoSideInspectAndValidateInput): Promise<TReport>;
  /**
   * Renders the report as markdown (the default format).
   */
  formatMarkdown(report: TReport): string;
  /**
   * Renders the report as JSON.
   */
  formatJson(report: TReport): string;
}

/**
 * Builds an MCP tool that lists configured items in a component / API
 * directory pair. Accepts required `componentDir` + `apiDir` plus an
 * optional `format: 'markdown' | 'json'` (default markdown), resolves
 * them against `process.cwd()` (rejecting paths that escape the cwd),
 * and threads the resolved paths through the domain-supplied
 * `inspectAndList` and the format dispatcher.
 *
 * Used by `dbx_notification_m_list_app` and `dbx_storagefile_m_list_app`.
 *
 * @param config - the domain-specific hooks and tool definition
 * @returns the registered {@link DbxTool}
 */
export function createListAppTool<TReport>(config: CreateListAppToolConfig<TReport>): DbxTool {
  const { definition, inspectAndList, formatMarkdown, formatJson } = config;

  async function run(rawArgs: unknown): Promise<ToolResult> {
    const parsed = ListAppArgsType(rawArgs);
    if (parsed instanceof type.errors) {
      return toolError(`Invalid arguments: ${parsed.summary}`);
    }

    const resolved = resolveTwoSideInput(parsed);
    if ('content' in resolved) {
      return resolved;
    }

    const report = await inspectAndList(resolved);
    const text = parsed.format === 'json' ? formatJson(report) : formatMarkdown(report);
    const toolResult: ToolResult = { content: [{ type: 'text', text }] };
    return toolResult;
  }

  const tool: DbxTool = { definition, run };
  return tool;
}
