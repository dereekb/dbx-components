import { type Maybe } from '@dereekb/util';
import { type ArrowFunctionExpression, type CallExpression, type Expression, type Identifier, type MemberExpression, type Node as AcornNode, type ObjectExpression, type Pattern, type PrivateIdentifier, type SpreadElement, type Statement, type Super, type VariableDeclaration, parse } from 'acorn';
import {
  OPENROUTER_TEMPLATE_BANNED_NAMES,
  OPENROUTER_TEMPLATE_SCRIPT_BUILT_IN_MEMBERS,
  OPENROUTER_TEMPLATE_SCRIPT_BUILT_IN_MEMBER_NAMES,
  OPENROUTER_TEMPLATE_SCRIPT_BUILT_IN_PROPERTY_NAMES,
  OPENROUTER_TEMPLATE_SCRIPT_FIRST_ARGUMENT_CALLBACK_METHODS,
  OPENROUTER_TEMPLATE_SCRIPT_GLOBALS,
  OPENROUTER_TEMPLATE_SCRIPT_SECOND_ARGUMENT_CALLBACK_METHODS,
  OpenRouterTemplateMode,
  type OpenRouterTemplateScriptPhase,
  isOpenRouterTemplateModeWithBody
} from './openrouter.template';
import { type OpenRouterTemplateTypeConfig, addOpenRouterTemplateJsonSchemaFieldNames } from './openrouter.template.type';

/**
 * The longest a template script may be, in characters.
 */
export const OPENROUTER_TEMPLATE_SCRIPT_MAX_LENGTH = 20000;

/**
 * The most AST nodes a template script may parse to.
 */
export const OPENROUTER_TEMPLATE_SCRIPT_MAX_NODES = 5000;

/**
 * The deepest a template script's AST may nest.
 */
export const OPENROUTER_TEMPLATE_SCRIPT_MAX_DEPTH = 200;

/**
 * The most errors one validation reports. Validation stops collecting after this many.
 */
export const OPENROUTER_TEMPLATE_SCRIPT_MAX_ERRORS = 50;

/**
 * Names a script may not declare, beyond the globals and the banned names.
 */
const OPENROUTER_TEMPLATE_SCRIPT_RESERVED_BINDING_NAMES: ReadonlySet<string> = new Set(['undefined', 'NaN', 'Infinity', 'globalThis', 'await', 'yield', 'let', 'static']);

/**
 * The globals that can be called as conversions, and passed as callbacks.
 */
const OPENROUTER_TEMPLATE_SCRIPT_CONVERSION_GLOBALS: ReadonlySet<string> = new Set(['String', 'Number', 'Boolean']);

/**
 * The members a script may use on each global, by global. `context` is checked separately.
 */
const OPENROUTER_TEMPLATE_SCRIPT_GLOBAL_MEMBERS: Readonly<Record<string, readonly string[]>> = {
  Math: OPENROUTER_TEMPLATE_SCRIPT_BUILT_IN_MEMBERS.Math,
  Number: OPENROUTER_TEMPLATE_SCRIPT_BUILT_IN_MEMBERS.Number,
  Array: OPENROUTER_TEMPLATE_SCRIPT_BUILT_IN_MEMBERS.Array,
  JSON: OPENROUTER_TEMPLATE_SCRIPT_BUILT_IN_MEMBERS.JSON,
  String: [],
  Boolean: []
};

const OPENROUTER_TEMPLATE_SCRIPT_LOGICAL_OPERATORS: ReadonlySet<string> = new Set(['&&', '||', '??']);
const OPENROUTER_TEMPLATE_SCRIPT_BINARY_OPERATORS: ReadonlySet<string> = new Set(['+', '-', '*', '/', '%', '===', '!==', '<', '<=', '>', '>=']);
const OPENROUTER_TEMPLATE_SCRIPT_UNARY_OPERATORS: ReadonlySet<string> = new Set(['!', '-']);

/**
 * One problem found in a template script.
 */
export interface OpenRouterTemplateScriptError {
  /**
   * What is wrong, written for the script's author.
   */
  readonly message: string;
  /**
   * The 1-based line of the problem, when it has a position.
   */
  readonly line?: Maybe<number>;
  /**
   * The 1-based column of the problem, when it has a position.
   */
  readonly column?: Maybe<number>;
}

/**
 * The result of {@link validateOpenRouterTemplateScript}.
 */
export interface OpenRouterTemplateScriptValidation {
  /**
   * Whether the script passed every check.
   */
  readonly valid: boolean;
  /**
   * Every problem found, up to {@link OPENROUTER_TEMPLATE_SCRIPT_MAX_ERRORS}.
   */
  readonly errors: OpenRouterTemplateScriptError[];
  /**
   * The accessors the script calls.
   */
  readonly usedAccessors: string[];
}

/**
 * Config for {@link validateOpenRouterTemplateScript}.
 */
export interface ValidateOpenRouterTemplateScriptConfig {
  /**
   * The script source: the body of the async function it runs as.
   */
  readonly code: string;
  /**
   * The template type the script is written for.
   */
  readonly typeConfig: OpenRouterTemplateTypeConfig;
  /**
   * Which script this is. Defaults to `body`.
   */
  readonly phase?: Maybe<OpenRouterTemplateScriptPhase>;
  /**
   * The JSON Schema of the version's `json_schema` text format, when it has one. It may not declare a banned property name.
   */
  readonly outputJsonSchema?: Maybe<object>;
}

/**
 * Where an expression sits, which decides what it may be.
 *
 * - `value`: an ordinary value.
 * - `callee`: the function of a call.
 * - `callback`: a callback argument of a built-in method; may also be an ordinary value.
 * - `member`: the object of a member access.
 * - `await`: the direct operand of an `await`. An ordinary value, except that an accessor call must sit here.
 */
type ScriptSlot = 'value' | 'callee' | 'callback' | 'member' | 'await';

interface ScriptBinding {
  readonly kind: 'const' | 'let' | 'param';
  /**
   * Whether the binding is a const holding a script arrow function.
   */
  readonly arrow: boolean;
}

interface ScriptScope {
  readonly bindings: Map<string, ScriptBinding>;
  readonly parent?: Maybe<ScriptScope>;
}

interface ScriptValueInfo {
  /**
   * Set when the value is the `context` global.
   */
  readonly context?: boolean;
  /**
   * Set when the value is `context.accessor`, which may only be used to call an accessor.
   */
  readonly accessorObject?: boolean;
  /**
   * Set when the value is a `context.accessor.<name>` member, which may only be called, and awaited.
   */
  readonly accessor?: Maybe<string>;
  /**
   * Set when the value is a global other than `context`, read for one of its members.
   */
  readonly global?: Maybe<string>;
  /**
   * Set when the value is a conversion global (`String`, `Number`, `Boolean`) in a callee or callback slot.
   */
  readonly conversion?: boolean;
  /**
   * Set when the value is a script arrow function.
   */
  readonly arrow?: boolean;
}

/**
 * Validates a template script against its type. This is the security boundary for uploaded scripts: a script that fails any
 * check can never be published or run.
 *
 * The script is parsed with acorn as the body of an async function, and the tree is walked with an exhaustive switch where
 * any node type not explicitly allowed is refused. In short:
 *
 * - statements: `const`/`let`, `if`, blocks, `return`, and expression statements that are a call, an `await` or an
 *   assignment to a script `let`. No loops, `switch`, `try`, `throw`, labels, function or class declarations, or directives;
 * - expressions: literals (no regex or bigint), untagged templates, `?:`, `&& || ??`, `+ - * / %`, strict comparisons,
 *   `!` and unary `-`, member access (computed only with an integer or a string literal), calls, plain object and array
 *   literals, and non-async arrow functions;
 * - free names: only {@link OPENROUTER_TEMPLATE_SCRIPT_GLOBALS};
 * - property names: any name except a banned one. Names are always checked decoded, so a unicode escape cannot hide one. A
 *   name of an allowed built-in method can only be called, so a data field named like one (`at`, `map`, `find`, …) cannot
 *   be read;
 * - context members: `context.data` and `context.notification` (values, never called), and `context.accessor.<name>()`
 *   (the type's accessors), in every mode with a body. `context` and `context.accessor` can only be used to read a member:
 *   they are never aliased, passed, destructured, indexed or called;
 * - accessors: an accessor takes no arguments, can only be called, and the call must be the direct operand of `await`;
 * - calls: a const-declared arrow, `String`/`Number`/`Boolean`, a built-in method, or an accessor;
 * - globals: `Math`, `JSON`, `Number` and `Array` expose only their allowed members, and `String` and `Boolean` none;
 * - callbacks: `map`/`filter`/`find`/`some`/`every`/`reduce` take an arrow, a const arrow or a conversion as their callback,
 *   and no `thisArg` (`reduce` takes at most an initial value), and `JSON.stringify` takes no replacer. With call syntax
 *   already restricted, this closes every way the engine could invoke a function value a script read off data;
 * - functions: an arrow may only be declared with `const` or passed as a callback, a function value can only be called or
 *   passed as a callback, and a function body may only reference bindings declared before it. With no loops, this rules out
 *   recursion and so guarantees termination.
 *
 * Reads of fields a type does not declare are not refused: what a script can read is exactly what the data and accessors
 * hand it, which their authors are responsible for.
 *
 * A final script (`phase: 'final'`) follows the same rules, plus `context.output`, and may never return `openRouter`. In
 * {@link OpenRouterTemplateMode.OPENROUTER} mode it sees only `context.output`.
 *
 * @param config - The script, its type and its phase.
 * @returns Whether it is valid, every problem found, and the accessors it uses.
 */
export function validateOpenRouterTemplateScript(config: ValidateOpenRouterTemplateScriptConfig): OpenRouterTemplateScriptValidation {
  const { code, typeConfig, outputJsonSchema } = config;
  const phase = config.phase ?? 'body';
  const errors: OpenRouterTemplateScriptError[] = [];
  const usedAccessors = new Set<string>();

  function addError(message: string, node?: Maybe<AcornNode>): void {
    if (errors.length < OPENROUTER_TEMPLATE_SCRIPT_MAX_ERRORS) {
      const start = node?.loc?.start;
      errors.push({ message, line: start?.line, column: start == null ? undefined : start.column + 1 });
    }
  }

  // MARK: Phase and type
  if (phase === 'body' && typeConfig.mode === OpenRouterTemplateMode.OPENROUTER) {
    addError('A template of an OPENROUTER type has no body script.');
  } else if (phase === 'final' && typeConfig.mode === OpenRouterTemplateMode.DETERMINISTIC) {
    addError('A template of a DETERMINISTIC type never calls a model, so it has no final script.');
  } else if (phase === 'final' && typeConfig.finalScript == null) {
    addError('This template type does not allow a final script.');
  }

  if (typeof code !== 'string' || code.trim() === '') {
    addError('The script is empty.');
  } else if (code.length > OPENROUTER_TEMPLATE_SCRIPT_MAX_LENGTH) {
    addError(`The script is ${code.length} characters long, over the limit of ${OPENROUTER_TEMPLATE_SCRIPT_MAX_LENGTH}.`);
  }

  let program: Maybe<ReturnType<typeof parse>>;

  if (errors.length === 0) {
    try {
      program = parse(code, { ecmaVersion: 'latest', sourceType: 'script', allowReturnOutsideFunction: true, allowAwaitOutsideFunction: true, locations: true });
    } catch (e) {
      const loc = (e as { loc?: { line: number; column: number } }).loc;
      errors.push({ message: `The script does not parse: ${(e as Error).message}`, line: loc?.line, column: loc == null ? undefined : loc.column + 1 });
    }
  }

  if (program != null) {
    // MARK: Size
    let nodeCount = 0;
    let tooBig = false;

    function measure(value: unknown, depth: number): void {
      if (!tooBig && value != null && typeof value === 'object') {
        if (Array.isArray(value)) {
          value.forEach((x) => measure(x, depth));
        } else if (typeof (value as { type?: unknown }).type === 'string') {
          nodeCount += 1;

          if (nodeCount > OPENROUTER_TEMPLATE_SCRIPT_MAX_NODES) {
            tooBig = true;
            addError(`The script has more than ${OPENROUTER_TEMPLATE_SCRIPT_MAX_NODES} syntax nodes.`);
          } else if (depth > OPENROUTER_TEMPLATE_SCRIPT_MAX_DEPTH) {
            tooBig = true;
            addError(`The script nests deeper than ${OPENROUTER_TEMPLATE_SCRIPT_MAX_DEPTH} levels.`, value as AcornNode);
          } else {
            Object.entries(value).forEach(([key, child]) => {
              if (key !== 'loc') {
                measure(child, depth + 1);
              }
            });
          }
        }
      }
    }

    measure(program, 0);

    if (!tooBig) {
      walkProgram(program.body as Statement[]);
    }
  }

  function walkProgram(body: Statement[]): void {
    // MARK: Names
    const accessorNames: ReadonlySet<string> = typeConfig.contextFactory?.accessorNames ?? new Set();
    const hasBody = isOpenRouterTemplateModeWithBody(typeConfig.mode);

    if (phase === 'final' && outputJsonSchema != null) {
      const jsonNames = new Set<string>();
      addOpenRouterTemplateJsonSchemaFieldNames({ schema: outputJsonSchema, path: 'output.json', propertyNames: jsonNames, paths: new Set() });

      jsonNames.forEach((x) => {
        if (OPENROUTER_TEMPLATE_BANNED_NAMES.has(x)) {
          addError(`The output JSON schema declares the banned property name "${x}".`);
        }
      });
    }

    // MARK: Helpers
    function resolve(name: string, scope: ScriptScope): Maybe<ScriptBinding> {
      let current: Maybe<ScriptScope> = scope;
      let binding: Maybe<ScriptBinding>;

      while (current != null && binding == null) {
        binding = current.bindings.get(name);
        current = current.parent;
      }

      return binding;
    }

    function childScope(parent: ScriptScope): ScriptScope {
      return { bindings: new Map(), parent };
    }

    function checkBindingName(name: string, node: AcornNode): boolean {
      let ok = false;

      if (OPENROUTER_TEMPLATE_SCRIPT_GLOBALS.includes(name)) {
        addError(`A script cannot declare "${name}", which would shadow a global.`, node);
      } else if (OPENROUTER_TEMPLATE_BANNED_NAMES.has(name)) {
        addError(`"${name}" is a banned name.`, node);
      } else if (OPENROUTER_TEMPLATE_SCRIPT_RESERVED_BINDING_NAMES.has(name)) {
        addError(`A script cannot declare "${name}".`, node);
      } else {
        ok = true;
      }

      return ok;
    }

    function checkPropertyName(name: string, node: AcornNode): boolean {
      let ok = false;

      if (OPENROUTER_TEMPLATE_BANNED_NAMES.has(name)) {
        addError(`"${name}" is a banned name.`, node);
      } else if (phase === 'final' && name === 'openRouter') {
        addError('A final script cannot return OpenRouter details, so there is never a second model call.', node);
      } else {
        ok = true;
      }

      return ok;
    }

    function reportMethodRead(name: string, node: AcornNode): void {
      addError(`\`.${name}\` is a built-in method, so it must be called. A data field named like a built-in method cannot be read.`, node);
    }

    // MARK: Statements
    function checkStatements(statements: Statement[], scope: ScriptScope): void {
      statements.forEach((x) => checkStatement(x, scope));
    }

    function checkStatement(node: Statement, scope: ScriptScope): void {
      switch (node.type) {
        case 'VariableDeclaration':
          checkVariableDeclaration(node, scope);
          break;
        case 'IfStatement':
          checkExpression(node.test, scope, 'value');
          checkStatement(node.consequent, childScope(scope));

          if (node.alternate != null) {
            checkStatement(node.alternate, childScope(scope));
          }
          break;
        case 'BlockStatement':
          checkStatements(node.body, childScope(scope));
          break;
        case 'ReturnStatement':
          if (node.argument != null) {
            checkExpression(node.argument, scope, 'value');
          }
          break;
        case 'EmptyStatement':
          break;
        case 'ExpressionStatement': {
          const expression = node.expression;

          if (node.directive != null) {
            addError('Directives such as "use strict" are not allowed; the runner adds strict mode itself.', node);
          } else if (expression.type === 'AssignmentExpression') {
            checkAssignment(expression, scope);
          } else if (expression.type === 'CallExpression' || expression.type === 'AwaitExpression' || (expression.type === 'ChainExpression' && expression.expression.type === 'CallExpression')) {
            checkExpression(expression, scope, 'value');
          } else {
            addError('Only a call, an await or an assignment can be a statement.', node);
          }
          break;
        }
        default:
          addError(`${describeNodeType(node.type)} is not allowed in a template script.`, node);
          break;
      }
    }

    function checkVariableDeclaration(node: VariableDeclaration, scope: ScriptScope): void {
      const kind = node.kind;

      if (kind !== 'const' && kind !== 'let') {
        addError(`\`${kind}\` declarations are not allowed; use const or let.`, node);
      } else {
        node.declarations.forEach((declarator) => {
          const { id, init } = declarator;
          let arrow = false;

          // The init is checked BEFORE the declaration's own names are bound, so an arrow can never reference itself.
          if (init != null) {
            if (init.type === 'ArrowFunctionExpression' && kind === 'const' && id.type === 'Identifier') {
              checkArrow(init, scope);
              arrow = true;
            } else {
              checkExpression(init, scope, 'value');
            }
          }

          checkPattern(id, scope, kind, arrow);
        });
      }
    }

    function checkPattern(node: Pattern, scope: ScriptScope, kind: ScriptBinding['kind'], arrow: boolean): void {
      switch (node.type) {
        case 'Identifier':
          if (checkBindingName(node.name, node)) {
            scope.bindings.set(node.name, { kind, arrow });
          }
          break;
        case 'ObjectPattern':
          node.properties.forEach((property) => {
            if (property.type === 'RestElement') {
              addError('Rest elements are not allowed.', property);
            } else if (property.computed) {
              addError('Computed keys are not allowed in a pattern.', property);
            } else {
              const keyName = readKeyName(property.key);

              if (keyName == null) {
                addError('A pattern key must be a name.', property.key);
              } else if (checkPropertyName(keyName, property.key)) {
                if (isBuiltInMethodName(keyName)) {
                  reportMethodRead(keyName, property.key);
                } else {
                  checkPatternTarget(property.value, scope, kind);
                }
              }
            }
          });
          break;
        case 'ArrayPattern':
          node.elements.forEach((element) => {
            if (element != null) {
              checkPatternTarget(element, scope, kind);
            }
          });
          break;
        case 'AssignmentPattern':
          addError('Default values are not allowed; use ?? instead.', node);
          break;
        case 'RestElement':
          addError('Rest elements are not allowed.', node);
          break;
        default:
          addError(`${describeNodeType(node.type)} is not allowed as a binding.`, node);
          break;
      }
    }

    function checkPatternTarget(node: Pattern, scope: ScriptScope, kind: ScriptBinding['kind']): void {
      if (node.type === 'Identifier') {
        checkPattern(node, scope, kind, false);
      } else if (node.type === 'AssignmentPattern') {
        addError('Default values are not allowed; use ?? instead.', node);
      } else if (node.type === 'RestElement') {
        addError('Rest elements are not allowed.', node);
      } else {
        addError('A pattern may only bind names, not nested patterns.', node);
      }
    }

    function checkAssignment(node: Extract<Expression, { type: 'AssignmentExpression' }>, scope: ScriptScope): void {
      if (node.operator !== '=' && node.operator !== '+=') {
        addError(`The \`${node.operator}\` operator is not allowed; use = or +=.`, node);
      } else if (node.left.type === 'Identifier') {
        const binding = resolve(node.left.name, scope);

        if (binding?.kind !== 'let') {
          addError(`"${node.left.name}" is not a variable declared with let, so it cannot be assigned to.`, node.left);
        }
      } else {
        addError('Only a variable declared with let can be assigned to.', node.left);
      }

      checkExpression(node.right, scope, 'value');
    }

    // MARK: Functions
    function checkArrow(node: ArrowFunctionExpression, scope: ScriptScope): void {
      if (node.async) {
        addError('Async arrow functions are not allowed.', node);
      } else if (node.generator) {
        addError('Generators are not allowed.', node);
      } else {
        const functionScope = childScope(scope);

        node.params.forEach((param) => checkPattern(param, functionScope, 'param', false));

        if (node.body.type === 'BlockStatement') {
          checkStatements(node.body.body, functionScope);
        } else {
          checkExpression(node.body, functionScope, 'value');
        }
      }
    }

    // MARK: Expressions
    function checkIdentifier(node: Identifier, scope: ScriptScope, slot: ScriptSlot): ScriptValueInfo {
      const name = node.name;
      const binding = resolve(name, scope);
      let info: ScriptValueInfo = {};

      if (OPENROUTER_TEMPLATE_BANNED_NAMES.has(name)) {
        addError(`"${name}" is a banned name.`, node);
      } else if (binding != null) {
        if (binding.arrow) {
          if (slot === 'callee' || slot === 'callback') {
            info = { arrow: true };
          } else {
            addError(`"${name}" is a function, so it can only be called or passed as a callback.`, node);
          }
        } else if (slot === 'callee') {
          addError(`"${name}" cannot be called. Only an arrow function declared with const can be called.`, node);
        }
      } else if (name === 'context') {
        if (slot === 'member') {
          info = { context: true };
        } else {
          addError('`context` can only be used to read its members, such as `context.data`.', node);
        }
      } else if (OPENROUTER_TEMPLATE_SCRIPT_CONVERSION_GLOBALS.has(name)) {
        if (slot === 'member') {
          info = { global: name };
        } else if (slot === 'callee' || slot === 'callback') {
          info = { conversion: true };
        } else {
          addError(`\`${name}\` can only be called, passed as a callback, or used to read its members.`, node);
        }
      } else if (OPENROUTER_TEMPLATE_SCRIPT_GLOBALS.includes(name)) {
        if (slot === 'member') {
          info = { global: name };
        } else if (slot === 'callee' && name === 'Array') {
          addError('`Array(...)` cannot be called; only `Array.isArray` is available.', node);
        } else {
          addError(`\`${name}\` can only be used to read its members.`, node);
        }
      } else {
        addError(`"${name}" is not defined. A script can only use ${OPENROUTER_TEMPLATE_SCRIPT_GLOBALS.join(', ')} and the names it declares earlier.`, node);
      }

      return info;
    }

    function readMemberName(node: MemberExpression): { readonly ok: boolean; readonly name: Maybe<string> } {
      const property = node.property;
      let ok = false;
      let name: Maybe<string>;

      if (property.type === 'PrivateIdentifier') {
        addError('Private names are not allowed.', property);
      } else if (!node.computed) {
        if (property.type === 'Identifier') {
          ok = true;
          name = property.name;
        } else {
          addError('Member names must be identifiers.', property);
        }
      } else if (property.type === 'Literal' && typeof property.value === 'number') {
        if (Number.isInteger(property.value) && property.value >= 0) {
          ok = true;
        } else {
          addError('A computed index must be a non-negative integer.', property);
        }
      } else if (property.type === 'Literal' && typeof property.value === 'string') {
        ok = true;
        name = property.value;
      } else {
        addError('Computed member access is only allowed with a non-negative integer or a string literal.', property);
      }

      return { ok, name };
    }

    function checkMember(node: MemberExpression, scope: ScriptScope, slot: ScriptSlot): { readonly info: ScriptValueInfo; readonly name: Maybe<string>; readonly objectInfo: ScriptValueInfo } {
      const objectInfo = node.object.type === 'Super' ? reportSuper(node.object) : checkExpression(node.object, scope, 'member');
      const { ok, name } = readMemberName(node);
      let info: ScriptValueInfo = {};

      if (ok) {
        if (objectInfo.context) {
          info = checkContextMember(node, name, slot);
        } else if (objectInfo.accessorObject) {
          info = checkAccessorMember(node, name, slot);
        } else if (name == null) {
          if (objectInfo.global != null) {
            addError(`\`${objectInfo.global}\` has no indexed members.`, node.property);
          }
        } else if (checkPropertyName(name, node.property)) {
          const globalMembers = objectInfo.global == null ? undefined : OPENROUTER_TEMPLATE_SCRIPT_GLOBAL_MEMBERS[objectInfo.global];

          if (globalMembers != null && !globalMembers.includes(name)) {
            const owner = objectInfo.global as string;
            const memberList = globalMembers.map((x) => owner + '.' + x).join(', ');
            const available = globalMembers.length > 0 ? `A script can use ${memberList}.` : `\`${owner}\` has no members a script can use.`;
            addError(`\`${objectInfo.global}.${name}\` is not available. ${available}`, node.property);
          } else if (isBuiltInMethodName(name) && slot !== 'callee') {
            reportMethodRead(name, node.property);
          }
        }
      }

      return { info, name: ok ? name : undefined, objectInfo };
    }

    function checkContextMember(node: MemberExpression, name: Maybe<string>, slot: ScriptSlot): ScriptValueInfo {
      let info: ScriptValueInfo = {};

      if (name == null) {
        addError('`context` has no indexed members.', node.property);
      } else if (OPENROUTER_TEMPLATE_BANNED_NAMES.has(name)) {
        addError(`"${name}" is a banned name.`, node.property);
      } else if (hasBody && (name === 'data' || name === 'notification')) {
        if (slot === 'callee') {
          addError(`\`context.${name}\` cannot be called.`, node);
        }
      } else if (hasBody && name === 'accessor') {
        if (slot === 'member') {
          info = { accessorObject: true };
        } else {
          addError('`context.accessor` can only be used to call an accessor, such as `await context.accessor.profile()`.', node);
        }
      } else if (phase === 'final' && name === 'output') {
        if (slot === 'callee') {
          addError('`context.output` cannot be called.', node);
        }
      } else {
        addError(`\`context.${name}\` is not available to this script.`, node.property);
      }

      return info;
    }

    function checkAccessorMember(node: MemberExpression, name: Maybe<string>, slot: ScriptSlot): ScriptValueInfo {
      let info: ScriptValueInfo = {};

      if (name == null) {
        addError('`context.accessor` has no indexed members.', node.property);
      } else if (OPENROUTER_TEMPLATE_BANNED_NAMES.has(name)) {
        addError(`"${name}" is a banned name.`, node.property);
      } else if (!accessorNames.has(name)) {
        addError(`\`context.accessor.${name}\` is not an accessor of this template type.`, node.property);
      } else if (slot === 'callee') {
        usedAccessors.add(name);
        info = { accessor: name };
      } else {
        addError(`\`context.accessor.${name}\` is an accessor, so it can only be called: \`await context.accessor.${name}()\`.`, node);
      }

      return info;
    }

    function reportSuper(node: Super): ScriptValueInfo {
      addError('`super` is not allowed.', node);
      return {};
    }

    function checkCall(node: CallExpression, scope: ScriptScope, slot: ScriptSlot): ScriptValueInfo {
      const callee = node.callee;
      const args = node.arguments;
      let callbackIndex = -1;
      let callbackMethod: Maybe<string>;

      if (args.some((x) => x.type === 'SpreadElement')) {
        addError('Spread arguments are not allowed.', node);
      }

      if (callee.type === 'Super') {
        reportSuper(callee);
      } else if (callee.type === 'Identifier') {
        checkIdentifier(callee, scope, 'callee');
      } else if (callee.type === 'MemberExpression') {
        const { info: calleeInfo, name, objectInfo } = checkMember(callee, scope, 'callee');

        if (calleeInfo.accessor != null) {
          if (args.length > 0) {
            addError(`Accessors take no arguments: \`context.accessor.${calleeInfo.accessor}()\`.`, node);
          }

          if (slot !== 'await') {
            addError(`Await the accessor: \`await context.accessor.${calleeInfo.accessor}()\`.`, node);
          }
        } else if (!objectInfo.context && !objectInfo.accessorObject) {
          if (name == null) {
            addError('Only named methods can be called.', callee);
          } else if (isBuiltInMethodName(name)) {
            callbackIndex = checkBuiltInMethodArguments(node, name);
            callbackMethod = callbackIndex === 0 ? name : undefined;
          } else {
            addError(`\`.${name}\` cannot be called. Only the allowed built-in methods and \`context.accessor\` accessors can be called.`, callee.property);
          }
        }
      } else {
        addError('Only a declared arrow function, a conversion (String, Number, Boolean), a built-in method or an accessor can be called.', callee);
        checkExpression(callee, scope, 'value');
      }

      args.forEach((arg, i) => {
        if (arg.type !== 'SpreadElement') {
          if (i !== callbackIndex) {
            checkExpression(arg, scope, 'value');
          } else if (arg.type === 'ArrowFunctionExpression') {
            checkArrow(arg, scope);
          } else {
            const callbackInfo = checkExpression(arg, scope, 'callback');

            if (callbackMethod != null && !callbackInfo.arrow && !callbackInfo.conversion) {
              addError(`\`.${callbackMethod}\` needs an arrow function, a const arrow or String/Number/Boolean as its callback.`, arg);
            }
          }
        }
      });

      return {};
    }

    /**
     * Checks the arguments of a call to an allowed built-in method: no `thisArg` after a callback, and no `JSON.stringify`
     * replacer.
     *
     * @param node - The call.
     * @param name - The method name.
     * @returns The index of the argument that may be a callback, or -1.
     */
    function checkBuiltInMethodArguments(node: CallExpression, name: string): number {
      const args = node.arguments;
      let callbackIndex = -1;

      if (OPENROUTER_TEMPLATE_SCRIPT_FIRST_ARGUMENT_CALLBACK_METHODS.has(name)) {
        const maxArguments = name === 'reduce' ? 2 : 1;
        callbackIndex = 0;

        if (args.length > maxArguments) {
          addError(name === 'reduce' ? '`.reduce` takes only its callback and an initial value.' : `\`.${name}\` takes only its callback; a \`thisArg\` is not allowed.`, node);
        }
      } else if (OPENROUTER_TEMPLATE_SCRIPT_SECOND_ARGUMENT_CALLBACK_METHODS.has(name)) {
        callbackIndex = 1;
      }

      if (name === 'stringify' && args.length > 1 && !isNullLiteral(args[1])) {
        addError('`JSON.stringify` takes no replacer: leave the second argument out or pass null.', args[1]);
      }

      return callbackIndex;
    }

    function checkObject(node: ObjectExpression, scope: ScriptScope): void {
      node.properties.forEach((property) => {
        if (property.type === 'SpreadElement') {
          addError('Spread is not allowed.', property);
        } else if (property.kind !== 'init') {
          addError('Getters and setters are not allowed.', property);
        } else if (property.method) {
          addError('Methods are not allowed in object literals.', property);
        } else if (property.computed) {
          addError('Computed keys are not allowed.', property);
        } else {
          const key = property.key;
          const keyName = readKeyName(key);

          if (keyName == null) {
            addError('An object key must be a name or a string.', key);
          } else {
            checkPropertyName(keyName, key);
          }

          checkExpression(property.value, scope, 'value');
        }
      });
    }

    function checkExpressionOrSpread(node: Expression | SpreadElement | PrivateIdentifier, scope: ScriptScope): void {
      if (node.type === 'SpreadElement') {
        addError('Spread is not allowed.', node);
      } else if (node.type === 'PrivateIdentifier') {
        addError('Private names are not allowed.', node);
      } else {
        checkExpression(node, scope, 'value');
      }
    }

    function checkExpression(node: Expression, scope: ScriptScope, slot: ScriptSlot): ScriptValueInfo {
      let info: ScriptValueInfo = {};

      switch (node.type) {
        case 'Identifier':
          info = checkIdentifier(node, scope, slot);
          break;
        case 'Literal':
          if (node.regex != null) {
            addError('Regular expressions are not allowed.', node);
          } else if (node.bigint != null || typeof node.value === 'bigint') {
            addError('BigInt literals are not allowed.', node);
          } else if (typeof node.value === 'number' && !Number.isFinite(node.value)) {
            addError('Number literals must be finite.', node);
          }
          break;
        case 'TemplateLiteral':
          node.expressions.forEach((x) => checkExpression(x, scope, 'value'));
          break;
        case 'ConditionalExpression':
          checkExpression(node.test, scope, 'value');
          checkExpression(node.consequent, scope, 'value');
          checkExpression(node.alternate, scope, 'value');
          break;
        case 'LogicalExpression':
          if (!OPENROUTER_TEMPLATE_SCRIPT_LOGICAL_OPERATORS.has(node.operator)) {
            addError(`The \`${node.operator}\` operator is not allowed.`, node);
          }

          checkExpression(node.left, scope, 'value');
          checkExpression(node.right, scope, 'value');
          break;
        case 'BinaryExpression':
          if (!OPENROUTER_TEMPLATE_SCRIPT_BINARY_OPERATORS.has(node.operator)) {
            addError(`The \`${node.operator}\` operator is not allowed.`, node);
          }

          checkExpressionOrSpread(node.left, scope);
          checkExpression(node.right, scope, 'value');
          break;
        case 'UnaryExpression':
          if (!OPENROUTER_TEMPLATE_SCRIPT_UNARY_OPERATORS.has(node.operator) || !node.prefix) {
            addError(`The \`${node.operator}\` operator is not allowed.`, node);
          }

          checkExpression(node.argument, scope, 'value');
          break;
        case 'MemberExpression':
          info = checkMember(node, scope, slot).info;
          break;
        case 'ChainExpression':
          info = node.expression.type === 'CallExpression' ? checkCall(node.expression, scope, slot) : checkMember(node.expression, scope, slot).info;
          break;
        case 'CallExpression':
          info = checkCall(node, scope, slot);
          break;
        case 'AwaitExpression':
          checkExpression(node.argument, scope, 'await');
          break;
        case 'ArrowFunctionExpression':
          if (slot === 'callback') {
            checkArrow(node, scope);
            info = { arrow: true };
          } else {
            addError('An arrow function can only be declared with const or passed as a callback.', node);
          }
          break;
        case 'ObjectExpression':
          checkObject(node, scope);
          break;
        case 'ArrayExpression':
          node.elements.forEach((x) => {
            if (x != null) {
              checkExpressionOrSpread(x, scope);
            }
          });
          break;
        case 'AssignmentExpression':
          addError('An assignment can only be a statement of its own.', node);
          break;
        default:
          addError(`${describeNodeType(node.type)} is not allowed in a template script.`, node);
          break;
      }

      return info;
    }

    checkStatements(body, { bindings: new Map() });
  }

  return { valid: errors.length === 0, errors, usedAccessors: Array.from(usedAccessors) };
}

const OPENROUTER_TEMPLATE_SCRIPT_NODE_DESCRIPTIONS: Readonly<Record<string, string>> = {
  ForStatement: 'A for loop',
  ForInStatement: 'A for…in loop',
  ForOfStatement: 'A for…of loop',
  WhileStatement: 'A while loop',
  DoWhileStatement: 'A do…while loop',
  SwitchStatement: 'A switch statement',
  TryStatement: 'A try statement',
  ThrowStatement: 'A throw statement',
  LabeledStatement: 'A label',
  BreakStatement: 'A break statement',
  ContinueStatement: 'A continue statement',
  WithStatement: 'A with statement',
  DebuggerStatement: 'A debugger statement',
  FunctionDeclaration: 'A function declaration',
  FunctionExpression: 'A function expression',
  ClassDeclaration: 'A class',
  ClassExpression: 'A class',
  ThisExpression: '`this`',
  NewExpression: '`new`',
  ImportExpression: '`import()`',
  MetaProperty: '`import.meta` / `new.target`',
  YieldExpression: '`yield`',
  SequenceExpression: 'The comma operator',
  UpdateExpression: '`++` / `--`',
  TaggedTemplateExpression: 'A tagged template',
  SpreadElement: 'Spread',
  ImportDeclaration: 'An import',
  ExportNamedDeclaration: 'An export',
  ExportDefaultDeclaration: 'An export',
  ExportAllDeclaration: 'An export'
};

function isBuiltInMethodName(name: string): boolean {
  return OPENROUTER_TEMPLATE_SCRIPT_BUILT_IN_MEMBER_NAMES.has(name) && !OPENROUTER_TEMPLATE_SCRIPT_BUILT_IN_PROPERTY_NAMES.has(name);
}

function isNullLiteral(node: Expression | SpreadElement): boolean {
  return node.type === 'Literal' && node.value === null && node.regex == null;
}

function readKeyName(key: Expression | PrivateIdentifier): Maybe<string> {
  let name: Maybe<string>;

  if (key.type === 'Identifier') {
    name = key.name;
  } else if (key.type === 'Literal' && typeof key.value === 'string') {
    name = key.value;
  }

  return name;
}

function describeNodeType(type: string): string {
  return OPENROUTER_TEMPLATE_SCRIPT_NODE_DESCRIPTIONS[type] ?? `\`${type}\``;
}
