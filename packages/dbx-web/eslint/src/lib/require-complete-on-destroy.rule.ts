import { type AstNode, COMPLETE_ON_DESTROY_HELPER, DEREEKB_DBX_CORE_MODULE, type ImportRegistry, RXJS_MODULE, SUBJECT_NAMES, createImportRegistry, ensureNamedImportFix, findAngularComponentDecorator, findNgOnDestroyMethod, getClassMemberName, isCalledIdentifier, isDeclareProperty, isImportedFrom, isStaticProperty, trackImportDeclaration } from './util';
import { collectNgOnDestroyRemovalFixes } from './require-clean-subscription.rule';

/**
 * Identifier names accepted as the wrapper around a manual `new <Subject>(...)`.
 *
 * Only `completeOnDestroy` is accepted — `clean()` does not call `.complete()`
 * on a Subject (Subjects are neither `Destroyable` nor `DestroyFunction`).
 */
const ACCEPTED_WRAPPERS: ReadonlySet<string> = new Set([COMPLETE_ON_DESTROY_HELPER]);

/**
 * ESLint rule definition shape used by `require-complete-on-destroy`.
 */
export interface DbxWebRequireCompleteOnDestroyRuleDefinition {
  readonly meta: {
    readonly type: 'problem';
    readonly fixable: 'code';
    readonly docs: {
      readonly description: string;
      readonly recommended: boolean;
    };
    readonly messages: {
      readonly missingCompleteOnDestroy: string;
    };
    readonly schema: readonly object[];
  };
  create(context: AstNode): Record<string, (node: AstNode) => void>;
}

/**
 * Input for {@link buildSubjectFix}.
 */
interface BuildSubjectFixInput {
  /**
   * The ESLint RuleFixer.
   */
  readonly fixer: AstNode;
  /**
   * The flagged NewExpression node (`new BehaviorSubject(...)` etc.).
   */
  readonly newExpr: AstNode;
  /**
   * The class property's name. Used to find matching `this.<name>.complete()` statements.
   */
  readonly propName: string;
  /**
   * The class's `ngOnDestroy()` MethodDefinition node, or null.
   */
  readonly ngOnDestroy: AstNode | null;
  /**
   * The file's import registry, mutated as fixes are queued.
   */
  readonly registry: ImportRegistry;
  /**
   * The ESLint sourceCode service for the current file.
   */
  readonly sourceCode: AstNode;
}

/**
 * ESLint rule that requires class-field initializers of `new Subject(...)`,
 * `new BehaviorSubject(...)`, `new ReplaySubject(...)`, and `new AsyncSubject(...)`
 * to be wrapped with `completeOnDestroy(...)` from `@dereekb/dbx-core` on
 * `@Component` / `@Directive` / `@Pipe` classes.
 *
 * Fires only when the Subject identifier is imported from `rxjs`.
 *
 * Auto-fix:
 * - Wraps the initializer with `completeOnDestroy(...)`.
 * - Inserts the `completeOnDestroy` named import from `@dereekb/dbx-core` if missing.
 * - Removes any matching `this.<field>.complete();` line from the same class's `ngOnDestroy`.
 */
export const dbxWebRequireCompleteOnDestroyRule: DbxWebRequireCompleteOnDestroyRuleDefinition = {
  meta: {
    type: 'problem',
    fixable: 'code',
    docs: {
      description: 'Require completeOnDestroy() wrapping new Subject/BehaviorSubject/ReplaySubject/AsyncSubject in Angular component, directive, or pipe classes',
      recommended: true
    },
    messages: {
      missingCompleteOnDestroy: 'Wrap `new {{subjectName}}(...)` with `completeOnDestroy(...)` from @dereekb/dbx-core. completeOnDestroy registers cleanup with Angular DestroyRef automatically, removing the need for manual complete() in ngOnDestroy.'
    },
    schema: []
  },
  create(context: AstNode) {
    const registry = createImportRegistry();
    const sourceCode = context.sourceCode;

    const visitClass = (classNode: AstNode): void => {
      const matchedDecorator = findAngularComponentDecorator(classNode, registry);

      if (!matchedDecorator) {
        return;
      }

      const members = classNode.body?.body ?? [];
      const ngOnDestroy = findNgOnDestroyMethod(classNode);

      for (const member of members) {
        if (member.type !== 'PropertyDefinition' || isStaticProperty(member) || isDeclareProperty(member)) {
          continue;
        }

        const propName = getClassMemberName(member);
        const initializer = member.value;

        if (!propName || !initializer) {
          continue;
        }

        const subjectName = unwrappedSubjectNewName(initializer, registry);

        if (!subjectName) {
          continue;
        }

        context.report({
          node: initializer,
          messageId: 'missingCompleteOnDestroy',
          data: { subjectName },
          fix: (fixer: AstNode) =>
            buildSubjectFix({
              fixer,
              newExpr: initializer,
              propName,
              ngOnDestroy,
              registry,
              sourceCode
            })
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
 * Returns the Subject class name when the given initializer is a bare
 * `new Subject/BehaviorSubject/ReplaySubject/AsyncSubject(...)` whose
 * identifier resolves to the import from `rxjs`. Returns null otherwise
 * (including when the expression is already wrapped).
 *
 * @param expression - The initializer expression AST node.
 * @param registry - The file's import registry.
 * @returns The matched Subject identifier name, or null.
 */
function unwrappedSubjectNewName(expression: AstNode, registry: ImportRegistry): string | null {
  let result: string | null = null;

  if (!isCalledIdentifier(expression, ACCEPTED_WRAPPERS) && expression.type === 'NewExpression') {
    const callee = expression.callee;

    if (callee?.type === 'Identifier' && SUBJECT_NAMES.has(callee.name) && isImportedFrom(registry, callee.name, RXJS_MODULE)) {
      result = callee.name;
    }
  }

  return result;
}

/**
 * Builds the composite fix for one violating property.
 *
 * @param input - The flagged expression, its property name, the class's ngOnDestroy node, the import registry, and source-code services.
 * @returns A list of fix operations.
 */
function buildSubjectFix(input: BuildSubjectFixInput): AstNode[] {
  const { fixer, newExpr, propName, ngOnDestroy, registry, sourceCode } = input;
  const fixes: AstNode[] = [];

  fixes.push(fixer.insertTextBefore(newExpr, `${COMPLETE_ON_DESTROY_HELPER}(`));
  fixes.push(fixer.insertTextAfter(newExpr, ')'));

  const importFix = ensureNamedImportFix({ fixer, registry, importName: COMPLETE_ON_DESTROY_HELPER, fromSource: DEREEKB_DBX_CORE_MODULE });

  if (importFix) {
    fixes.push(importFix);
  }

  if (ngOnDestroy) {
    collectNgOnDestroyRemovalFixes({
      fixer,
      ngOnDestroy,
      propName,
      methodName: 'complete',
      sourceCode,
      fixes
    });
  }

  return fixes;
}
