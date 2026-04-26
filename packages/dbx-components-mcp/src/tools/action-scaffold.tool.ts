/**
 * `dbx_action_scaffold` tool.
 *
 * Generates an action wiring skeleton — directives + handler + optional store
 * provider — from a small, structured input describing the trigger style,
 * confirmation behavior, success feedback, and value/result types. Pure
 * synchronous: no I/O, just template + handler + import-list strings.
 *
 * The tool emits a markdown response with three fenced blocks:
 *
 *   1. HTML template fragment (the directive stack)
 *   2. TypeScript handler fragment (component class snippet)
 *   3. Imports list
 *
 * Plus a "Notes" section listing the directives wired and pointing at the
 * matching `dbx_action_examples` pattern.
 */

import { type Tool } from '@modelcontextprotocol/sdk/types.js';
import { type } from 'arktype';
import { toolError, type DbxTool, type ToolResult } from './types.js';

// MARK: Tool advertisement
const TRIGGER_VALUES = ['button', 'form', 'auto-modify'] as const;
const SUCCESS_FEEDBACK_VALUES = ['snackbar', 'redirect', 'none'] as const;
const CONTEXT_PROVIDER_VALUES = ['inline', 'parent', 'host-component'] as const;

const DBX_ACTION_SCAFFOLD_TOOL: Tool = {
  name: 'dbx_action_scaffold',
  description: [
    'Scaffold a dbx-core action wiring: directives + handler + optional context provider.',
    '',
    'Inputs:',
    '  • `use_case` — short label for the operation (e.g. "delete account", "submit settings").',
    '  • `trigger` — `"button"`, `"form"`, or `"auto-modify"` (auto-trigger on form modification).',
    '  • `confirm` — wrap the trigger in a popover-confirm (button only).',
    '  • `success_feedback` — `"snackbar"`, `"redirect"`, or `"none"`.',
    '  • `context_provider` — `"inline"` (component owns the action), `"parent"` (consumes via [dbxActionSource]), or `"host-component"` (a wrapper component owns it).',
    '  • `value_type` — TypeScript type the action receives (e.g. `"AccountId"`, `"SettingsValue"`).',
    '  • `result_type` — optional TypeScript type the handler returns (defaults to `void`).',
    '',
    'Output: a markdown bundle with the template fragment, component class fragment, imports list, and a notes section pointing at the closest `dbx_action_examples` pattern.'
  ].join('\n'),
  inputSchema: {
    type: 'object',
    properties: {
      use_case: { type: 'string', description: 'Short label for the operation (used to name the handler and types).' },
      trigger: { type: 'string', enum: [...TRIGGER_VALUES], description: 'How the action is triggered.' },
      confirm: { type: 'boolean', description: 'Wrap the trigger in a popover confirm (button trigger only).', default: false },
      success_feedback: { type: 'string', enum: [...SUCCESS_FEEDBACK_VALUES], description: 'How to surface a successful resolution.', default: 'snackbar' },
      context_provider: { type: 'string', enum: [...CONTEXT_PROVIDER_VALUES], description: 'Where the action context lives.', default: 'inline' },
      value_type: { type: 'string', description: 'TypeScript value type the handler receives.' },
      result_type: { type: 'string', description: 'TypeScript result type produced by the handler. Defaults to void.' }
    },
    required: ['use_case', 'trigger', 'value_type']
  }
};

// MARK: Input validation
const ScaffoldArgsType = type({
  use_case: 'string',
  trigger: "'button' | 'form' | 'auto-modify'",
  'confirm?': 'boolean',
  'success_feedback?': "'snackbar' | 'redirect' | 'none'",
  'context_provider?': "'inline' | 'parent' | 'host-component'",
  value_type: 'string',
  'result_type?': 'string'
});

interface ParsedScaffoldArgs {
  readonly useCase: string;
  readonly trigger: 'button' | 'form' | 'auto-modify';
  readonly confirm: boolean;
  readonly successFeedback: 'snackbar' | 'redirect' | 'none';
  readonly contextProvider: 'inline' | 'parent' | 'host-component';
  readonly valueType: string;
  readonly resultType: string;
}

function parseScaffoldArgs(raw: unknown): ParsedScaffoldArgs {
  const parsed = ScaffoldArgsType(raw);
  if (parsed instanceof type.errors) {
    throw new Error(`Invalid arguments: ${parsed.summary}`);
  }
  const useCase = parsed.use_case.trim();
  const valueType = parsed.value_type.trim();
  if (useCase.length === 0) {
    throw new Error('Invalid arguments: use_case must not be empty.');
  }
  if (valueType.length === 0) {
    throw new Error('Invalid arguments: value_type must not be empty.');
  }
  const result: ParsedScaffoldArgs = {
    useCase,
    trigger: parsed.trigger,
    confirm: parsed.confirm ?? false,
    successFeedback: parsed.success_feedback ?? 'snackbar',
    contextProvider: parsed.context_provider ?? 'inline',
    valueType,
    resultType: parsed.result_type?.trim() || 'void'
  };
  return result;
}

// MARK: Naming helpers
function toCamelCase(useCase: string): string {
  const cleaned = useCase
    .replace(/[^a-zA-Z0-9 _-]/g, ' ')
    .split(/[\s_-]+/)
    .filter((w) => w.length > 0);
  let result = '';
  for (const [i, word] of cleaned.entries()) {
    const lower = word.toLowerCase();
    if (i === 0) {
      result += lower;
    } else {
      result += lower.charAt(0).toUpperCase() + lower.slice(1);
    }
  }
  if (result.length === 0) {
    result = 'action';
  }
  return result;
}

function toPascalCase(useCase: string): string {
  const camel = toCamelCase(useCase);
  return camel.charAt(0).toUpperCase() + camel.slice(1);
}

interface ScaffoldNames {
  readonly handlerName: string;
  readonly componentClassName: string;
  readonly componentSelector: string;
}

function deriveNames(useCase: string): ScaffoldNames {
  const camel = toCamelCase(useCase);
  const pascal = toPascalCase(useCase);
  const handlerName = `handle${pascal}`;
  const componentClassName = `${pascal}ActionComponent`;
  const componentSelector = `app-${camel.replace(/([A-Z])/g, '-$1').toLowerCase()}-action`.replace(/--+/g, '-');
  const result: ScaffoldNames = { handlerName, componentClassName, componentSelector };
  return result;
}

// MARK: Template builder
function buildTemplate(args: ParsedScaffoldArgs, names: ScaffoldNames): string {
  const lines: string[] = [];
  const rootDirectives: string[] = [];

  if (args.contextProvider === 'parent') {
    rootDirectives.push('[dbxActionSource]="actionSource"');
  } else {
    rootDirectives.push('dbxAction');
  }

  if (args.successFeedback === 'snackbar') {
    rootDirectives.push('dbxActionSnackbar');
    rootDirectives.push('dbxActionSnackbarDefault="save"');
  }

  rootDirectives.push(`[dbxActionHandler]="${names.handlerName}"`);

  if (args.trigger === 'form') {
    rootDirectives.push('dbxActionEnforceModified');
  }

  const rootTag = args.trigger === 'form' ? 'form' : 'div';
  lines.push(`<${rootTag} ${rootDirectives.join(' ')}>`);

  if (args.trigger === 'auto-modify') {
    lines.push('  <ng-container dbxActionAutoTrigger useFastTriggerPreset></ng-container>');
    lines.push('  <ng-container dbxActionAutoModify></ng-container>');
    lines.push('  <my-form dbxActionForm [dbxFormSource]="data$"></my-form>');
  } else if (args.trigger === 'form') {
    lines.push('  <my-form dbxActionForm [dbxFormSource]="data$"></my-form>');
  } else {
    lines.push('  <ng-container dbxActionValue></ng-container>');
  }

  if (args.trigger === 'button' || args.trigger === 'form') {
    const buttonAttrs: string[] = [];
    if (args.trigger === 'form') {
      buttonAttrs.push('[raised]="true"');
    }
    buttonAttrs.push(`text="${args.useCase}"`);
    if (args.confirm) {
      buttonAttrs.push('dbxActionPopoverConfirm');
    }
    buttonAttrs.push('dbxActionButton');
    lines.push(`  <dbx-button ${buttonAttrs.join(' ')}></dbx-button>`);
  }

  if (args.successFeedback === 'snackbar') {
    lines.push('  <dbx-error dbxActionError></dbx-error>');
  }

  lines.push(`</${rootTag}>`);

  return lines.join('\n');
}

// MARK: Handler builder
function buildHandler(args: ParsedScaffoldArgs, names: ScaffoldNames): string {
  const handlerType = args.trigger === 'button' && args.valueType === 'void' ? `Work<void, ${args.resultType}>` : `WorkUsingContext<${args.valueType}, ${args.resultType}>`;
  const lines: string[] = [];
  lines.push(`@Component({`);
  lines.push(`  selector: '${names.componentSelector}',`);
  lines.push(`  templateUrl: './${names.componentSelector}.component.html',`);
  lines.push(`  standalone: true`);
  lines.push(`})`);
  lines.push(`export class ${names.componentClassName} {`);

  if (args.contextProvider === 'parent') {
    lines.push(`  // Provided by an ancestor that owns the action source.`);
    lines.push(`  readonly actionSource = inject<ActionContextStoreSource<${args.valueType}, ${args.resultType}>>(ACTION_SOURCE_TOKEN);`);
    lines.push('');
  }

  if (args.trigger === 'form' || args.trigger === 'auto-modify') {
    lines.push(`  // TODO: replace with the upstream document/collection store for this use case.`);
    lines.push(`  private readonly store = inject(MyDocumentStore);`);
    lines.push(`  readonly data$ = this.store.data$;`);
    lines.push('');
  } else {
    lines.push(`  // TODO: replace with whatever supplies the action's input.`);
    lines.push(`  private readonly api = inject(MyApi);`);
    lines.push('');
  }

  lines.push(`  readonly ${names.handlerName}: ${handlerType} = (value, context) => {`);
  if (args.trigger === 'form' || args.trigger === 'auto-modify') {
    lines.push(`    context.startWorkingWithLoadingStateObservable(this.store.save(value));`);
  } else {
    lines.push(`    context.startWorkingWithLoadingStateObservable(this.api.run(value));`);
  }

  if (args.successFeedback === 'redirect') {
    lines.push('    context.successPair$.subscribe(() => {');
    lines.push("      // TODO: redirect after success — e.g. inject(StateService).go('home');");
    lines.push('    });');
  }
  lines.push('  };');
  lines.push('}');

  return lines.join('\n');
}

// MARK: Imports builder
function buildImports(args: ParsedScaffoldArgs): readonly string[] {
  const symbols = new Set<string>();
  symbols.add('Component');
  symbols.add('inject');
  const result: string[] = [];
  result.push(`import { ${Array.from(symbols).sort().join(', ')} } from '@angular/core';`);

  const dbxRxjsTypes: string[] = [];
  if (args.trigger === 'button' && args.valueType === 'void') {
    dbxRxjsTypes.push('type Work');
  } else {
    dbxRxjsTypes.push('type WorkUsingContext');
  }
  result.push(`import { ${dbxRxjsTypes.join(', ')} } from '@dereekb/rxjs';`);

  if (args.contextProvider === 'parent') {
    result.push("import { type ActionContextStoreSource } from '@dereekb/dbx-core';");
  }

  return result;
}

// MARK: Notes
function buildDirectivesUsed(args: ParsedScaffoldArgs): readonly string[] {
  const directives: string[] = [];
  directives.push(args.contextProvider === 'parent' ? '[dbxActionSource]' : 'dbxAction');
  if (args.trigger === 'form') {
    directives.push('dbxActionForm (from @dereekb/dbx-form)');
    directives.push('dbxActionEnforceModified');
    directives.push('dbxActionButton (from @dereekb/dbx-web)');
  } else if (args.trigger === 'auto-modify') {
    directives.push('dbxActionForm (from @dereekb/dbx-form)');
    directives.push('dbxActionAutoTrigger');
    directives.push('dbxActionAutoModify');
  } else {
    directives.push('dbxActionValue');
    directives.push('dbxActionButton (from @dereekb/dbx-web)');
  }
  if (args.confirm && args.trigger === 'button') {
    directives.push('dbxActionPopoverConfirm (from @dereekb/dbx-web)');
  }
  if (args.successFeedback === 'snackbar') {
    directives.push('dbxActionSnackbar');
    directives.push('dbxActionError');
  }
  directives.push('[dbxActionHandler]');
  return directives;
}

function relatedExamplePattern(args: ParsedScaffoldArgs): string {
  let slug: string;
  if (args.trigger === 'auto-modify') {
    slug = 'auto-trigger-on-modify';
  } else if (args.trigger === 'form') {
    slug = 'form-submit';
  } else if (args.contextProvider === 'parent') {
    slug = 'provide-context-up';
  } else {
    slug = 'button-confirm-delete';
  }
  return slug;
}

// MARK: Render
function renderScaffold(args: ParsedScaffoldArgs): string {
  const names = deriveNames(args.useCase);
  const template = buildTemplate(args, names);
  const handler = buildHandler(args, names);
  const imports = buildImports(args);
  const directivesUsed = buildDirectivesUsed(args);
  const examplePattern = relatedExamplePattern(args);

  const lines: string[] = [];
  lines.push(`# Action scaffold — ${args.useCase}`);
  lines.push('');
  lines.push(`Trigger: \`${args.trigger}\` · Confirm: \`${args.confirm}\` · Success feedback: \`${args.successFeedback}\` · Context: \`${args.contextProvider}\``);
  lines.push('');
  lines.push('## Template');
  lines.push('');
  lines.push('```html');
  lines.push(template);
  lines.push('```');
  lines.push('');
  lines.push('## Component class');
  lines.push('');
  lines.push('```ts');
  lines.push(handler);
  lines.push('```');
  lines.push('');
  lines.push('## Imports');
  lines.push('');
  lines.push('```ts');
  for (const line of imports) {
    lines.push(line);
  }
  lines.push('```');
  lines.push('');
  lines.push('## Notes');
  lines.push('');
  lines.push('Directives wired:');
  lines.push('');
  for (const directive of directivesUsed) {
    lines.push(`- \`${directive}\``);
  }
  lines.push('');
  lines.push(`→ See \`dbx_action_examples pattern="${examplePattern}"\` for the closest matching pattern.`);

  return lines.join('\n');
}

// MARK: Handler
/**
 * Tool handler for `dbx_action_scaffold`. Validates the request, renders the
 * scaffold output for the requested action role, and packages it as tool
 * content.
 *
 * @param rawArgs - the unvalidated tool arguments object from the MCP runtime
 * @returns the rendered scaffold, or an error result when args fail validation
 */
export function runActionScaffold(rawArgs: unknown): ToolResult {
  let args: ParsedScaffoldArgs;
  try {
    args = parseScaffoldArgs(rawArgs);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return toolError(message);
  }
  const text = renderScaffold(args);
  const result: ToolResult = { content: [{ type: 'text', text }] };
  return result;
}

export const actionScaffoldTool: DbxTool = {
  definition: DBX_ACTION_SCAFFOLD_TOOL,
  run: runActionScaffold
};
