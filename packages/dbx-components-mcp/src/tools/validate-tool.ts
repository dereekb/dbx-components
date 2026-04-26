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
import { resolveFolderPaths } from './validate-input.js';

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
