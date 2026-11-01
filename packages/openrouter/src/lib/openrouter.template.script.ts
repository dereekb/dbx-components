import { type Maybe } from '@dereekb/util';
import { type ArrowFunctionExpression, type CallExpression, type Expression, type Identifier, type MemberExpression, type Node as AcornNode, type ObjectExpression, type Pattern, type PrivateIdentifier, type SpreadElement, type Statement, type Super, type VariableDeclaration, parse } from 'acorn';
import {
  OPENROUTER_TEMPLATE_BANNED_NAMES,
  OPENROUTER_TEMPLATE_BODY_RETURN_KEYS,
  OPENROUTER_TEMPLATE_FINAL_OUTPUT_NAMES,
  OPENROUTER_TEMPLATE_FINAL_RETURN_KEYS,
  OPENROUTER_TEMPLATE_SCRIPT_BUILT_IN_MEMBER_NAMES,
  OPENROUTER_TEMPLATE_SCRIPT_BUILT_IN_PROPERTY_NAMES,
  OPENROUTER_TEMPLATE_SCRIPT_FIRST_ARGUMENT_CALLBACK_METHODS,
  OPENROUTER_TEMPLATE_SCRIPT_GLOBALS,
  OPENROUTER_TEMPLATE_SCRIPT_SECOND_ARGUMENT_CALLBACK_METHODS,
  OpenRouterTemplateMode,
  type OpenRouterTemplateScriptPhase
} from './openrouter.template';
import { type OpenRouterTemplateTypeConfig, addOpenRouterTemplateJsonSchemaFieldNames, openRouterTemplateFieldNames } from './openrouter.template.type';

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
   * The loaders the script calls.
   */
  readonly usedLoaders: string[];
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
   * The JSON Schema of the version's `json_schema` text format, when it has one. A final script may read its declared fields
   * through `context.output.json`.
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
 */
type ScriptSlot = 'value' | 'callee' | 'callback' | 'member';

interface ScriptBinding {
  readonly kind: 'const' | 'let' | 'param';
  /**
   * Whether the binding is a const holding a script arrow function.
   */
  readonly arrow: boolean;
  /**
   * The declared path the binding's value sits at, when known.
   */
  readonly path?: Maybe<string>;
}

interface ScriptScope {
  readonly bindings: Map<string, ScriptBinding>;
  readonly parent?: Maybe<ScriptScope>;
}

interface ScriptValueInfo {
  /**
   * The declared path the value sits at, when known.
   */
  readonly path?: Maybe<string>;
  /**
   * Set when the value is the `context` global.
   */
  readonly context?: boolean;
  /**
   * Set when the value is a `context.loadX` member, which may only be called.
   */
  readonly loader?: Maybe<string>;
  /**
   * Set when the value is the not-yet-awaited result of calling a loader.
   */
  readonly loaderPromise?: Maybe<string>;
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
 *   `!` and unary `-`, member access (allowlisted names; computed only with an integer or allowlisted string literal),
 *   calls, plain object and array literals, and non-async arrow functions;
 * - free names: only {@link OPENROUTER_TEMPLATE_SCRIPT_GLOBALS};
 * - property names: only the type's declared fields, `input`, the loader names, the return keys and the fixed built-in set,
 *   and never a banned name. Names are always checked decoded, so a unicode escape cannot hide one;
 * - calls: a const-declared arrow, `String`/`Number`/`Boolean`, a built-in method, or `context.loadX()` with no arguments;
 * - functions: an arrow may only be declared with `const` or passed as a callback, a function value can only be called or
 *   passed as a callback, and a function body may only reference bindings declared before it. With no loops, this rules out
 *   recursion and so guarantees termination;
 * - authoring: every `context.input…`, `context.loadX()` result, and value destructured or derived from them, may only
 *   name declared fields.
 *
 * A final script (`phase: 'final'`) follows the same rules, plus `context.output` (`text`, `json` and the version's
 * `json_schema` fields), and may never return `openRouter`.
 *
 * @param config - The script, its type and its phase.
 * @returns Whether it is valid, every problem found, and the loaders it uses.
 */
export function validateOpenRouterTemplateScript(config: ValidateOpenRouterTemplateScriptConfig): OpenRouterTemplateScriptValidation {
  const { code, typeConfig, outputJsonSchema } = config;
  const phase = config.phase ?? 'body';
  const errors: OpenRouterTemplateScriptError[] = [];
  const usedLoaders = new Set<string>();

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
    const { propertyNames: declaredNames, paths: declaredPaths, loaderNames } = openRouterTemplateFieldNames(typeConfig);
    const paths = new Set(declaredPaths);
    const declaredFieldNames = new Set(declaredNames);
    const allowedPropertyNames = new Set<string>([...Array.from(declaredNames), ...Array.from(OPENROUTER_TEMPLATE_SCRIPT_BUILT_IN_MEMBER_NAMES)]);
    const hasInput = typeConfig.input != null;

    if (phase === 'final') {
      OPENROUTER_TEMPLATE_FINAL_OUTPUT_NAMES.forEach((x) => allowedPropertyNames.add(x));
      OPENROUTER_TEMPLATE_FINAL_RETURN_KEYS.forEach((x) => allowedPropertyNames.add(x));
      paths.add('output');
      paths.add('output.text');

      if (outputJsonSchema == null) {
        paths.add('output.json');
      } else {
        const jsonNames = new Set<string>();
        addOpenRouterTemplateJsonSchemaFieldNames({ schema: outputJsonSchema, path: 'output.json', propertyNames: jsonNames, paths });

        jsonNames.forEach((x) => {
          if (OPENROUTER_TEMPLATE_BANNED_NAMES.has(x)) {
            addError(`The output JSON schema declares the banned property name "${x}".`);
          }

          allowedPropertyNames.add(x);
          declaredFieldNames.add(x);
        });
      }
    } else {
      OPENROUTER_TEMPLATE_BODY_RETURN_KEYS.forEach((x) => allowedPropertyNames.add(x));
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
      } else if (allowedPropertyNames.has(name)) {
        ok = true;
      } else {
        addError(`"${name}" is not an allowed property name. A script can only use the template type's declared fields and the allowed built-in members.`, node);
      }

      return ok;
    }

    /**
     * Returns the child path for a property of a value at a declared path, reporting a property that the type does not
     * declare there.
     *
     * @param path - The parent path.
     * @param name - The property name, or null for an index.
     * @param node - The node to report on.
     * @returns The child path, when it is declared.
     */
    function childPath(path: Maybe<string>, name: Maybe<string>, node: AcornNode): Maybe<string> {
      let result: Maybe<string>;

      if (path != null) {
        if (name == null) {
          const itemPath = `${path}[]`;
          result = paths.has(itemPath) ? itemPath : undefined;
        } else {
          const candidate = `${path}.${name}`;

          if (paths.has(candidate)) {
            result = candidate;
          } else if (!OPENROUTER_TEMPLATE_SCRIPT_BUILT_IN_MEMBER_NAMES.has(name)) {
            addError(`"${name}" is not a declared field of \`${path}\`.`, node);
          }
        }
      }

      return result;
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
          let info: ScriptValueInfo = {};

          // The init is checked BEFORE the declaration's own names are bound, so an arrow can never reference itself.
          if (init != null) {
            if (init.type === 'ArrowFunctionExpression' && kind === 'const' && id.type === 'Identifier') {
              checkArrow(init, scope, []);
              info = { arrow: true };
            } else {
              info = checkExpression(init, scope, 'value');
            }
          }

          const path = kind === 'const' ? info.path : undefined;
          checkPattern(id, scope, kind, path, info.arrow ?? false);
        });
      }
    }

    function checkPattern(node: Pattern, scope: ScriptScope, kind: ScriptBinding['kind'], path: Maybe<string>, arrow: boolean): void {
      switch (node.type) {
        case 'Identifier':
          if (checkBindingName(node.name, node)) {
            scope.bindings.set(node.name, { kind, arrow, path });
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
                const valuePath = childPath(path, keyName, property.key);
                checkPatternTarget(property.value, scope, kind, valuePath);
              }
            }
          });
          break;
        case 'ArrayPattern':
          node.elements.forEach((element) => {
            if (element != null) {
              checkPatternTarget(element, scope, kind, childPath(path, null, element));
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

    function checkPatternTarget(node: Pattern, scope: ScriptScope, kind: ScriptBinding['kind'], path: Maybe<string>): void {
      if (node.type === 'Identifier') {
        checkPattern(node, scope, kind, path, false);
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
    function checkArrow(node: ArrowFunctionExpression, scope: ScriptScope, paramPaths: Maybe<string>[]): void {
      if (node.async) {
        addError('Async arrow functions are not allowed.', node);
      } else if (node.generator) {
        addError('Generators are not allowed.', node);
      } else {
        const functionScope = childScope(scope);

        node.params.forEach((param, i) => {
          if (param.type === 'Identifier' || param.type === 'ObjectPattern' || param.type === 'ArrayPattern') {
            checkPattern(param, functionScope, 'param', paramPaths[i], false);
          } else {
            checkPattern(param, functionScope, 'param', undefined, false);
          }
        });

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
        } else {
          info = { path: binding.path };
        }
      } else if (name === 'context') {
        if (slot === 'member') {
          info = { context: true };
        } else {
          addError('`context` can only be used to read its members, such as `context.input`.', node);
        }
      } else if (OPENROUTER_TEMPLATE_SCRIPT_CONVERSION_GLOBALS.has(name)) {
        if (slot === 'value') {
          addError(`\`${name}\` can only be called, passed as a callback, or used to read its members.`, node);
        }
      } else if (OPENROUTER_TEMPLATE_SCRIPT_GLOBALS.includes(name)) {
        if (slot === 'callee' && name === 'Array') {
          addError('`Array(...)` cannot be called; only `Array.isArray` is available.', node);
        } else if (slot !== 'member') {
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

      if (objectInfo.loaderPromise != null) {
        addError(`Await the loader before reading its result: \`(await context.${objectInfo.loaderPromise}())\`.`, node);
      } else if (ok && name != null) {
        if (objectInfo.context) {
          if (name === 'input' && hasInput && !(phase === 'final' && typeConfig.mode === OpenRouterTemplateMode.OPENROUTER)) {
            info = { path: 'input' };
          } else if (loaderNames.has(name)) {
            if (slot === 'callee') {
              usedLoaders.add(name);
              info = { loader: name };
            } else {
              addError(`\`context.${name}\` is a loader, so it can only be called: \`await context.${name}()\`.`, node);
            }
          } else if (name === 'output' && phase === 'final') {
            info = { path: 'output' };
          } else {
            addError(`\`context.${name}\` is not available to this script.`, node.property);
          }
        } else if (checkPropertyName(name, node.property)) {
          const isMethodName = OPENROUTER_TEMPLATE_SCRIPT_BUILT_IN_MEMBER_NAMES.has(name) && !OPENROUTER_TEMPLATE_SCRIPT_BUILT_IN_PROPERTY_NAMES.has(name) && !declaredFieldNames.has(name);

          if (isMethodName && slot !== 'callee') {
            addError(`\`.${name}\` is a method, so it must be called.`, node.property);
          } else {
            info = { path: childPath(objectInfo.path, name, node.property) };
          }
        }
      } else if (ok && objectInfo.context) {
        addError('`context` has no indexed members.', node.property);
      } else if (ok) {
        info = { path: childPath(objectInfo.path, null, node.property) };
      }

      return { info, name: ok ? name : undefined, objectInfo };
    }

    function reportSuper(node: Super): ScriptValueInfo {
      addError('`super` is not allowed.', node);
      return {};
    }

    function checkCall(node: CallExpression, scope: ScriptScope): ScriptValueInfo {
      const callee = node.callee;
      const args = node.arguments;
      let info: ScriptValueInfo = {};
      let callbackIndex = -1;
      let callbackParamPaths: Maybe<string>[] = [];

      if (args.some((x) => x.type === 'SpreadElement')) {
        addError('Spread arguments are not allowed.', node);
      }

      if (callee.type === 'Super') {
        reportSuper(callee);
      } else if (callee.type === 'Identifier') {
        checkIdentifier(callee, scope, 'callee');
      } else if (callee.type === 'MemberExpression') {
        const { info: calleeInfo, name, objectInfo } = checkMember(callee, scope, 'callee');

        if (calleeInfo.loader != null) {
          if (args.length > 0) {
            addError(`Loaders take no arguments: \`context.${calleeInfo.loader}()\`.`, node);
          }

          info = { loaderPromise: calleeInfo.loader };
        } else if (objectInfo.context) {
          if (calleeInfo.path != null) {
            addError(`\`context.${name ?? ''}\` cannot be called.`, callee);
          }
        } else if (name == null) {
          addError('Only named methods can be called.', callee);
        } else {
          if (!OPENROUTER_TEMPLATE_SCRIPT_BUILT_IN_MEMBER_NAMES.has(name) || OPENROUTER_TEMPLATE_SCRIPT_BUILT_IN_PROPERTY_NAMES.has(name)) {
            addError(`\`.${name}\` cannot be called. Only the allowed built-in methods and \`context\` loaders can be called.`, callee.property);
          } else {
            const itemPath = objectInfo.path != null && paths.has(`${objectInfo.path}[]`) ? `${objectInfo.path}[]` : undefined;

            if (OPENROUTER_TEMPLATE_SCRIPT_FIRST_ARGUMENT_CALLBACK_METHODS.has(name)) {
              callbackIndex = 0;
              callbackParamPaths = name === 'reduce' ? [undefined, itemPath] : [itemPath];
            } else if (OPENROUTER_TEMPLATE_SCRIPT_SECOND_ARGUMENT_CALLBACK_METHODS.has(name)) {
              callbackIndex = 1;
            }

            if (name === 'find' || name === 'at') {
              info = { path: itemPath };
            } else if (name === 'filter' || name === 'slice') {
              info = { path: itemPath == null ? undefined : objectInfo.path };
            }
          }
        }
      } else {
        addError('Only a declared arrow function, a conversion (String, Number, Boolean), a built-in method or a loader can be called.', callee);
        checkExpression(callee, scope, 'value');
      }

      args.forEach((arg, i) => {
        if (arg.type !== 'SpreadElement') {
          if (i === callbackIndex) {
            if (arg.type === 'ArrowFunctionExpression') {
              checkArrow(arg, scope, callbackParamPaths);
            } else {
              checkExpression(arg, scope, 'callback');
            }
          } else {
            checkExpression(arg, scope, 'value');
          }
        }
      });

      return info;
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
          info = node.expression.type === 'CallExpression' ? checkCall(node.expression, scope) : checkMember(node.expression, scope, slot).info;
          break;
        case 'CallExpression':
          info = checkCall(node, scope);
          break;
        case 'AwaitExpression':
          info = { path: checkExpression(node.argument, scope, 'value').loaderPromise };
          break;
        case 'ArrowFunctionExpression':
          if (slot === 'callback') {
            checkArrow(node, scope, []);
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

  return { valid: errors.length === 0, errors, usedLoaders: Array.from(usedLoaders) };
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
