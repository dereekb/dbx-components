import { ANGULAR_CORE_MODULE, type AstNode, type ImportRegistry, createImportRegistry, findAngularComponentDecorator, isDeclareProperty, isImportedFrom, isStaticProperty, trackImportDeclaration } from './util';

/**
 * Initializer call identifiers that produce an Angular signal input.
 *
 * Includes the bare `input(...)` form and the `input.required(...)` member form.
 * `model()` / `model.required()` are intentionally excluded — two-way bindings are
 * rare and counting them would inflate the threshold for components that mix them
 * sparingly. Extending the set is a one-line change.
 */
const INPUT_INITIALIZERS: ReadonlySet<string> = new Set(['input']);

/**
 * Default cap on the number of `input(...)` / `input.required(...)` properties a
 * single Angular component-tier class may declare before the rule fires.
 */
const DEFAULT_INPUT_THRESHOLD = 3;

/**
 * Options for {@link DBX_WEB_REQUIRE_COMPONENT_CONFIG_INPUT_RULE}.
 */
export interface DbxWebRequireComponentConfigInputRuleOptions {
  /**
   * Maximum number of signal-input properties allowed before the rule reports.
   * Defaults to {@link DEFAULT_INPUT_THRESHOLD}.
   */
  readonly threshold?: number;
}

/**
 * ESLint rule definition shape used by `require-component-config-input`.
 */
export interface DbxWebRequireComponentConfigInputRuleDefinition {
  readonly meta: {
    readonly type: 'suggestion';
    readonly fixable: undefined;
    readonly docs: {
      readonly description: string;
      readonly recommended: boolean;
    };
    readonly messages: {
      readonly tooManySignalInputs: string;
    };
    readonly schema: readonly object[];
  };
  create(context: AstNode): Record<string, (node: AstNode) => void>;
}

/**
 * ESLint rule that flags `@Component` / `@Directive` / `@Pipe` classes which
 * declare more than `threshold` (default 3) signal-input properties.
 *
 * When a component-tier class drifts past the threshold, the convention is to
 * consolidate the loose inputs into a single config-typed input, e.g.
 * `config = input<Maybe<DbxFooConfig>>()`. This rule does not enforce a specific
 * property name or shape — it is purely a count, analogous to the workspace's
 * `dereekb-util/prefer-config-object` rule for function parameters.
 *
 * Only `input(...)` and `input.required(...)` calls whose root identifier is
 * imported from `@angular/core` are counted. Static and `declare` members are
 * ignored, as are non-decorated classes and imports from other modules.
 *
 * Not auto-fixable: consolidating loose inputs into a config interface is a
 * design-level refactor that updates the template, the consuming sites, and the
 * type surface — outside the safe scope of an ESLint autofix.
 *
 * @see `dbx__note__angular-conventions` → ANG-C1 Component Config Input.
 */
export const DBX_WEB_REQUIRE_COMPONENT_CONFIG_INPUT_RULE: DbxWebRequireComponentConfigInputRuleDefinition = {
  meta: {
    type: 'suggestion',
    fixable: undefined,
    docs: {
      description: 'Disallow more than `threshold` (default 3) signal-input properties on a single @Component/@Directive/@Pipe class; consolidate them into a single config-typed input.',
      recommended: true
    },
    messages: {
      tooManySignalInputs: "Class '{{className}}' declares {{count}} signal inputs (more than {{threshold}}). Consolidate them into a single config-typed input (e.g. `config = input<Maybe<...Config>>()`). See dbx__note__angular-conventions → ANG-C1."
    },
    schema: [
      {
        type: 'object' as const,
        properties: {
          threshold: {
            type: 'number' as const,
            minimum: 0,
            description: 'Maximum number of signal-input properties allowed before the rule reports. Defaults to 3.'
          }
        },
        additionalProperties: false
      }
    ]
  },
  create(context: AstNode) {
    const registry = createImportRegistry();
    const options: DbxWebRequireComponentConfigInputRuleOptions = context.options?.[0] ?? {};
    const threshold: number = typeof options.threshold === 'number' ? options.threshold : DEFAULT_INPUT_THRESHOLD;

    const visitClass = (classNode: AstNode): void => {
      const matched = findAngularComponentDecorator(classNode, registry);

      if (!matched) {
        return;
      }

      const members: AstNode[] = classNode.body?.body ?? [];
      let inputCount = 0;

      for (const member of members) {
        if (member.type !== 'PropertyDefinition' || isStaticProperty(member) || isDeclareProperty(member)) {
          continue;
        }

        const initializer = member.value;

        if (initializer?.type === 'CallExpression' && isAngularInputCall(initializer, registry)) {
          inputCount += 1;
        }
      }

      if (inputCount > threshold) {
        const className: string = classNode.id?.name ?? '<anonymous>';

        context.report({
          node: classNode.id ?? classNode,
          messageId: 'tooManySignalInputs',
          data: { className, count: String(inputCount), threshold: String(threshold) }
        });
      }
    };

    return {
      ImportDeclaration(node: AstNode) {
        trackImportDeclaration(registry, node);
      },
      ClassDeclaration(classNode: AstNode) {
        visitClass(classNode);
      },
      ClassExpression(classNode: AstNode) {
        visitClass(classNode);
      }
    };
  }
};

/**
 * Returns true when `callExpression` is a call to an Angular signal-input
 * factory — either `input(...)` (Identifier callee) or `input.required(...)`
 * (MemberExpression callee whose root identifier is `input`) — and the root
 * identifier was imported from `@angular/core`.
 *
 * @param callExpression - The CallExpression AST node serving as a property initializer.
 * @param registry - The file's import registry.
 * @returns True when the call should be counted as a signal input.
 */
function isAngularInputCall(callExpression: AstNode, registry: ImportRegistry): boolean {
  const callee = callExpression.callee;
  let result = false;

  if (callee?.type === 'Identifier') {
    const name: string = callee.name;

    if (INPUT_INITIALIZERS.has(name) && isImportedFrom(registry, name, ANGULAR_CORE_MODULE)) {
      result = true;
    }
  } else if (callee?.type === 'MemberExpression' && callee.computed === false && callee.object?.type === 'Identifier' && callee.property?.type === 'Identifier' && callee.property.name === 'required') {
    const rootName: string = callee.object.name;

    if (INPUT_INITIALIZERS.has(rootName) && isImportedFrom(registry, rootName, ANGULAR_CORE_MODULE)) {
      result = true;
    }
  }

  return result;
}
