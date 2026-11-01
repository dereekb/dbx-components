import { type Maybe, type SmsTextSegmentDetails, smsTextSegmentDetails } from '@dereekb/util';
import {
  type AppOpenRouterTemplateTypeConfigService,
  type OpenRouterAttachedFileReference,
  type OpenRouterCore,
  type OpenRouterDecisionQuestions,
  type OpenRouterGenerationId,
  type OpenRouterInput,
  type OpenRouterModelConfig,
  type OpenRouterPromptDefinition,
  type OpenRouterPromptKey,
  type OpenRouterPromptSeedMessage,
  type OpenRouterPromptVersionNumber,
  type OpenRouterRequestTrace,
  type OpenRouterResolvedPrompt,
  type OpenRouterRunUsage,
  type OpenRouterTemplateBodyResult,
  type OpenRouterTemplateBodyResultKind,
  type OpenRouterTemplateBodyResultRead,
  type OpenRouterTemplateContext,
  type OpenRouterTemplateFinalContext,
  type OpenRouterTemplateFinalResult,
  type OpenRouterTemplateKey,
  type OpenRouterTemplateLoaders,
  type OpenRouterTemplateModelOutput,
  type OpenRouterTemplateReviewRecord,
  type OpenRouterTemplateReviewThresholds,
  type OpenRouterTemplateScriptError,
  type OpenRouterTemplateTypeConfig,
  type OpenRouterTemplateTypeKey,
  type Tool,
  OpenRouterTemplateMode,
  OpenRouterTemplateRenderError,
  OpenRouterTemplateTypeConfigError,
  callModelForOpenRouterRequest,
  checkOpenRouterTemplateOpenRouterInput,
  checkOpenRouterTemplateOutputText,
  compileOpenRouterTemplateScript,
  copyOpenRouterTemplateJsonOutput,
  isOpenRouterTemplateModeWithBody,
  isOpenRouterTemplateModeWithModel,
  openRouterDecision,
  openRouterDecisionRequest,
  openRouterPromptRequest,
  openRouterTemplateContext,
  openRouterTemplateFinalContext,
  openRouterTemplateReviewPromptDefinition,
  openRouterTemplateReviewQuestions,
  openRouterTemplateReviewState,
  parseOpenRouterJsonOutput,
  readOpenRouterTemplateBodyResult,
  readOpenRouterTemplateReviewVerdict,
  validateOpenRouterModelConfig,
  validateOpenRouterTemplateScript
} from '@dereekb/openrouter';
import { type OpenRouterTemplateCheckErrorData, type PreviewOpenRouterTemplateResult } from '@dereekb/openrouter/firebase';
import { type OpenRouterPromptService } from './openrouter.prompt.service';
import { type OpenRouterTemplateApprovalHash, type OpenRouterTemplateApprovalInput, type OpenRouterTemplateApprovalSecret, openRouterTemplateApprovalInputForResolvedPrompt, signOpenRouterTemplateApproval, verifyOpenRouterTemplateApproval } from './openrouter.template.approval';

// MARK: Version Content
/**
 * What a template version says: its scripts, and the instructions and model config its model call uses.
 */
export interface OpenRouterTemplateVersionContent {
  readonly script?: Maybe<string>;
  readonly finalScript?: Maybe<string>;
  readonly instructions?: Maybe<string>;
  readonly messages?: Maybe<OpenRouterPromptSeedMessage[]>;
  readonly config?: Maybe<OpenRouterModelConfig>;
  /**
   * Never allowed on a template version. Carried so the shape check can refuse it.
   */
  readonly questions?: Maybe<OpenRouterDecisionQuestions>;
}

/**
 * Reads what a resolved template version says.
 *
 * @param resolved - The resolved version.
 * @returns The version content.
 */
export function openRouterTemplateVersionContentForResolvedPrompt(resolved: OpenRouterResolvedPrompt): OpenRouterTemplateVersionContent {
  return { script: resolved.template?.script, finalScript: resolved.template?.finalScript, instructions: resolved.instructions, messages: resolved.messages, config: resolved.config, questions: resolved.questions };
}

function hasOpenRouterTemplateText(value: Maybe<string>): value is string {
  return value != null && value.trim() !== '';
}

/**
 * Whether a version carries any code — a body script, a final script, or both. Only such a version needs the static checks,
 * the review and an approval.
 *
 * @param content - The version content.
 * @returns Whether the version carries code.
 */
export function openRouterTemplateVersionHasCode(content: Pick<OpenRouterTemplateVersionContent, 'script' | 'finalScript'>): boolean {
  return hasOpenRouterTemplateText(content.script) || hasOpenRouterTemplateText(content.finalScript);
}

/**
 * The json schema a version's model config asks the model to answer in, when its text format is `json_schema`.
 *
 * @param config - The model config.
 * @returns The schema, or undefined.
 */
export function openRouterTemplateOutputJsonSchema(config: Maybe<OpenRouterModelConfig>): Maybe<Record<string, unknown>> {
  const format = config?.text?.format;
  return format?.type === 'json_schema' ? format.schema : undefined;
}

/**
 * The result of {@link checkOpenRouterTemplateVersionShape}.
 */
export interface OpenRouterTemplateVersionShapeCheck {
  readonly valid: boolean;
  readonly errors: string[];
  readonly warnings: string[];
}

/**
 * Checks a version's shape against its type's mode. Enforced at publish and at runtime.
 *
 * | Mode | Script | Final script | Model config | Questions |
 * |---|---|---|---|---|
 * | `DETERMINISTIC` | required | none | none, and no instructions or messages | none |
 * | `DETERMINISTIC_OPENROUTER` | required | per the type's `finalScript` | required (completion) | none |
 * | `DETERMINISTIC_OR_OPENROUTER` | required | per the type's `finalScript` | required (completion) | none |
 * | `OPENROUTER` | none | per the type's `finalScript` | required (completion) | none |
 *
 * The model's text format must be `text` unless a final script is present, since raw JSON is never message text.
 *
 * @param typeConfig - The template type.
 * @param content - What the version says.
 * @returns The check.
 */
export function checkOpenRouterTemplateVersionShape(typeConfig: OpenRouterTemplateTypeConfig, content: OpenRouterTemplateVersionContent): OpenRouterTemplateVersionShapeCheck {
  const { mode } = typeConfig;
  const errors: string[] = [];
  const warnings: string[] = [];
  const hasScript = hasOpenRouterTemplateText(content.script);
  const hasFinalScript = hasOpenRouterTemplateText(content.finalScript);
  const finalScriptSetting = mode === OpenRouterTemplateMode.DETERMINISTIC ? undefined : typeConfig.finalScript;

  if (content.questions != null) {
    errors.push('A template version never carries questions.');
  }

  if (isOpenRouterTemplateModeWithBody(mode)) {
    if (!hasScript) {
      errors.push(`A ${mode} template version requires a script.`);
    }
  } else if (content.script != null) {
    errors.push(`A ${mode} template version takes no script; it calls the model with the caller's input.`);
  }

  if (hasFinalScript && finalScriptSetting == null) {
    errors.push(`Template type "${typeConfig.type}" does not allow a final script.`);
  } else if (!hasFinalScript && finalScriptSetting === 'required') {
    errors.push(`Template type "${typeConfig.type}" requires a final script.`);
  }

  if (isOpenRouterTemplateModeWithModel(mode)) {
    const validation = validateOpenRouterModelConfig(content.config ?? {}, { decision: false });
    errors.push(...validation.errors);
    warnings.push(...validation.warnings);

    const formatType = content.config?.text?.format?.type;

    if (formatType != null && formatType !== 'text' && !hasFinalScript) {
      errors.push(`A \`${formatType}\` text format requires a final script, since raw model JSON is never message text.`);
    }
  } else if (hasOpenRouterTemplateText(content.instructions) || content.messages?.length || (content.config != null && Object.keys(content.config).length > 0)) {
    errors.push(`A ${mode} template version never calls a model, so it takes no instructions, messages or model config.`);
  }

  return { valid: errors.length === 0, errors, warnings };
}

// MARK: Code Templates
/**
 * A template whose body is a code render function, reviewed in pull requests rather than uploaded.
 *
 * It skips the approval and the review, and still gets context building, mode enforcement and the output checks.
 */
export interface OpenRouterCodeTemplate<I = any, L extends OpenRouterTemplateLoaders<I> = OpenRouterTemplateLoaders<I>> {
  /**
   * The template key. Disjoint from the stored templates: `create:template` refuses a code template's key.
   */
  readonly key: OpenRouterTemplateKey;
  /**
   * The template type.
   */
  readonly type: OpenRouterTemplateTypeConfig<I, L>;
  /**
   * The body. Required for every mode except {@link OpenRouterTemplateMode.OPENROUTER}.
   */
  readonly render?: Maybe<(context: OpenRouterTemplateContext<I, L>) => OpenRouterTemplateBodyResult | Promise<OpenRouterTemplateBodyResult>>;
  /**
   * The code twin of the final script, governed by the type's `finalScript` setting.
   */
  readonly finalize?: Maybe<(context: OpenRouterTemplateFinalContext<I, L>) => OpenRouterTemplateFinalResult | Promise<OpenRouterTemplateFinalResult>>;
  /**
   * The prompt whose instructions and model config the model call uses, in the modes that call one. Resolved through the
   * prompt service, so its text stays tunable at runtime.
   */
  readonly promptKey?: Maybe<OpenRouterPromptKey>;
}

/**
 * Creates a code template, refusing one whose parts don't fit its type's mode.
 *
 * @param config - The code template.
 * @returns The same code template.
 * @throws {OpenRouterTemplateTypeConfigError} When a part doesn't fit the type's mode.
 */
export function openRouterCodeTemplate<I, L extends OpenRouterTemplateLoaders<I> = OpenRouterTemplateLoaders<I>>(config: OpenRouterCodeTemplate<I, L>): OpenRouterCodeTemplate<I, L> {
  const { key, type: typeConfig, render, finalize, promptKey } = config;
  const { mode } = typeConfig;
  const errors: string[] = [];
  const finalScriptSetting = mode === OpenRouterTemplateMode.DETERMINISTIC ? undefined : typeConfig.finalScript;

  if (isOpenRouterTemplateModeWithBody(mode) !== (render != null)) {
    errors.push(render == null ? `A ${mode} code template requires render().` : `A ${mode} code template takes no render().`);
  }

  if (isOpenRouterTemplateModeWithModel(mode) !== (promptKey != null)) {
    errors.push(promptKey == null ? `A ${mode} code template requires a promptKey for its model call.` : `A ${mode} code template never calls a model, so it takes no promptKey.`);
  }

  if (finalize != null && finalScriptSetting == null) {
    errors.push(`Template type "${typeConfig.type}" does not allow finalize().`);
  } else if (finalize == null && finalScriptSetting === 'required') {
    errors.push(`Template type "${typeConfig.type}" requires finalize().`);
  }

  if (errors.length > 0) {
    throw new OpenRouterTemplateTypeConfigError(`Code template "${key}"`, errors);
  }

  return config;
}

// MARK: Render
/**
 * The `callModelForPrompt` params an {@link OpenRouterTemplateMode.OPENROUTER} template passes to its model call untouched.
 */
export interface OpenRouterTemplateOpenRouterCallParams {
  readonly input?: Maybe<OpenRouterInput>;
  readonly configOverrides?: Maybe<OpenRouterModelConfig>;
  readonly files?: Maybe<OpenRouterAttachedFileReference[]>;
  readonly tools?: Maybe<readonly Tool[]>;
  readonly trace?: Maybe<OpenRouterRequestTrace>;
}

/**
 * Preview options for {@link OpenRouterTemplateService.renderTemplate}.
 */
export interface OpenRouterTemplatePreviewOptions {
  /**
   * Data that stands in for the loaders. Defaults to the type's sample loader data.
   */
  readonly loaderData?: Maybe<Record<string, unknown>>;
  /**
   * Whether to make the model call. When false the render stops before it, and a final script is fed {@link modelOutput}.
   */
  readonly callModel?: Maybe<boolean>;
  /**
   * The model output to feed a final script when the model isn't called. Defaults to the type's sample output.
   */
  readonly modelOutput?: Maybe<OpenRouterTemplateModelOutput>;
  /**
   * A draft to render in place of what the stored version says. Each field left undefined keeps the version's own. A draft
   * needs no approval: its code arrives with the request and is checked the same way as at publish.
   */
  readonly draft?: Maybe<OpenRouterTemplateVersionContent>;
}

/**
 * Params for {@link OpenRouterTemplateService.renderTemplate}.
 */
export interface RenderOpenRouterTemplateParams {
  /**
   * The template key: a code template's, or a stored template's prompt key.
   */
  readonly templateKey: OpenRouterTemplateKey;
  /**
   * The version to render. Omit for the active version.
   */
  readonly version?: Maybe<OpenRouterPromptVersionNumber>;
  /**
   * The template input, in every mode except {@link OpenRouterTemplateMode.OPENROUTER}.
   */
  readonly input?: unknown;
  /**
   * The model call params, in {@link OpenRouterTemplateMode.OPENROUTER} mode.
   */
  readonly openRouter?: Maybe<OpenRouterTemplateOpenRouterCallParams>;
  /**
   * Trace attached to the model call.
   */
  readonly trace?: Maybe<OpenRouterRequestTrace>;
  /**
   * Renders as a preview.
   */
  readonly preview?: Maybe<OpenRouterTemplatePreviewOptions>;
}

/**
 * Where a rendered template came from.
 */
export type OpenRouterTemplateSource = 'code' | 'store';

/**
 * The model call a render made.
 */
export interface OpenRouterTemplateRenderOpenRouterDetails {
  readonly generationIds: OpenRouterGenerationId[];
  readonly usage?: Maybe<OpenRouterRunUsage>;
  readonly model?: Maybe<string>;
}

/**
 * The result of {@link OpenRouterTemplateService.renderTemplate}.
 */
export interface OpenRouterTemplateRenderResult {
  /**
   * The checked, trimmed message text. Absent when the render produced no message, or a preview stopped before the model.
   */
  readonly text?: Maybe<string>;
  /**
   * Whether the render produced no message, which means nothing is sent.
   */
  readonly empty: boolean;
  readonly templateKey: OpenRouterTemplateKey;
  /**
   * The stored version rendered, or the version of the prompt a code template called.
   */
  readonly version?: Maybe<OpenRouterPromptVersionNumber>;
  readonly templateType: OpenRouterTemplateTypeKey;
  readonly mode: OpenRouterTemplateMode;
  /**
   * What the body returned. Always `openrouter` in {@link OpenRouterTemplateMode.OPENROUTER} mode.
   */
  readonly path: OpenRouterTemplateBodyResultKind;
  /**
   * Whether a final script, or a code template's `finalize`, produced the text.
   */
  readonly finalized: boolean;
  readonly source: OpenRouterTemplateSource;
  /**
   * The OpenRouter input the body handed off, when it did.
   */
  readonly openRouterInput?: Maybe<string>;
  /**
   * Whether the model was called.
   */
  readonly modelCalled: boolean;
  /**
   * The model call, when one was made.
   */
  readonly openRouter?: Maybe<OpenRouterTemplateRenderOpenRouterDetails>;
  /**
   * The text's SMS metrics.
   */
  readonly metrics?: Maybe<SmsTextSegmentDetails>;
}

/**
 * Raised when a render's final text fails the output checks.
 */
export class OpenRouterTemplateOutputError extends OpenRouterTemplateRenderError {
  readonly errors: string[];

  constructor(errors: string[]) {
    super(`The rendered text failed its checks: ${errors.join(' ')}`);
    this.name = 'OpenRouterTemplateOutputError';
    this.errors = errors;
  }
}

// MARK: Validate
/**
 * Params for {@link OpenRouterTemplateService.validateTemplateVersion}.
 */
export interface ValidateOpenRouterTemplateVersionParams {
  readonly typeConfig: OpenRouterTemplateTypeConfig;
  readonly content: OpenRouterTemplateVersionContent;
  /**
   * Whether to run the review when every other check passes and the version carries code. Costs a model call.
   */
  readonly review?: Maybe<boolean>;
}

/**
 * The result of {@link OpenRouterTemplateService.validateTemplateVersion}.
 */
export interface OpenRouterTemplateVersionValidation extends OpenRouterTemplateCheckErrorData {
  readonly valid: boolean;
  readonly warnings: string[];
  /**
   * The review record, when the review ran.
   */
  readonly review?: Maybe<OpenRouterTemplateReviewRecord>;
}

/**
 * A signed approval.
 */
export interface OpenRouterTemplateApproval {
  readonly approvalHash: OpenRouterTemplateApprovalHash;
  readonly approvedAt: Date;
}

/**
 * Overrides for the template review.
 */
export interface OpenRouterTemplateServiceReviewConfig {
  /**
   * The review prompt definition. Asked directly rather than resolved from the store, so a Firestore edit can't weaken it.
   * Defaults to {@link openRouterTemplateReviewPromptDefinition}.
   */
  readonly definition?: Maybe<OpenRouterPromptDefinition>;
  /**
   * Per-question flag thresholds.
   */
  readonly thresholds?: Maybe<OpenRouterTemplateReviewThresholds>;
}

/**
 * Params for {@link OpenRouterTemplateService.previewTemplate}.
 */
export interface PreviewOpenRouterTemplateServiceParams {
  readonly templateKey: OpenRouterTemplateKey;
  readonly version?: Maybe<OpenRouterPromptVersionNumber>;
  readonly draft?: Maybe<OpenRouterTemplateVersionContent>;
  /**
   * The template input. Defaults to the type's sample input.
   */
  readonly input?: unknown;
  readonly loaderData?: Maybe<Record<string, unknown>>;
  readonly modelOutput?: Maybe<OpenRouterTemplateModelOutput>;
  readonly review?: Maybe<boolean>;
  readonly callModel?: Maybe<boolean>;
}

// MARK: Service
/**
 * Renders message templates, and validates and approves template versions.
 */
export abstract class OpenRouterTemplateService {
  abstract readonly typeConfigService: AppOpenRouterTemplateTypeConfigService;
  /**
   * Returns the code template with the key, if there is one.
   */
  abstract codeTemplate(templateKey: OpenRouterTemplateKey): Maybe<OpenRouterCodeTemplate>;
  /**
   * Renders a template into its message text.
   */
  abstract renderTemplate(params: RenderOpenRouterTemplateParams): Promise<OpenRouterTemplateRenderResult>;
  /**
   * Previews a template, or a draft of one, through the real render path. A stored version or draft runs only once its
   * static checks pass. Problems are reported rather than thrown.
   */
  abstract previewTemplate(params: PreviewOpenRouterTemplateServiceParams): Promise<PreviewOpenRouterTemplateResult>;
  /**
   * Validates a version: its shape, its static script checks, its model config and, optionally, the review.
   */
  abstract validateTemplateVersion(params: ValidateOpenRouterTemplateVersionParams): Promise<OpenRouterTemplateVersionValidation>;
  /**
   * Signs a version's approval. Fails closed when no approval secret is configured.
   */
  abstract approveTemplateVersion(input: OpenRouterTemplateApprovalInput): OpenRouterTemplateApproval;
  /**
   * Whether a resolved version's approval matches what it says now. Fails closed when no approval secret is configured.
   */
  abstract verifyTemplateVersionApproval(resolved: OpenRouterResolvedPrompt): boolean;
}

/**
 * Config for {@link openRouterTemplateService}.
 */
export interface OpenRouterTemplateServiceConfig {
  readonly typeConfigService: AppOpenRouterTemplateTypeConfigService;
  readonly promptService: OpenRouterPromptService;
  readonly client: OpenRouterCore;
  /**
   * The approval secret. When missing, approving and rendering stored scripts are both refused.
   */
  readonly approvalSecret?: Maybe<OpenRouterTemplateApprovalSecret>;
  readonly codeTemplates?: Maybe<OpenRouterCodeTemplate[]>;
  readonly review?: Maybe<OpenRouterTemplateServiceReviewConfig>;
}

/**
 * What a render runs: a code template, or a stored version (or a draft of one).
 */
interface OpenRouterTemplateRenderSource {
  readonly source: OpenRouterTemplateSource;
  readonly templateKey: OpenRouterTemplateKey;
  readonly typeConfig: OpenRouterTemplateTypeConfig;
  /**
   * The prompt the model call uses, in the modes that call one.
   */
  readonly prompt?: Maybe<OpenRouterResolvedPrompt>;
  readonly content: OpenRouterTemplateVersionContent;
  readonly codeTemplate?: Maybe<OpenRouterCodeTemplate>;
  readonly version?: Maybe<OpenRouterPromptVersionNumber>;
}

/**
 * Creates an {@link OpenRouterTemplateService}.
 *
 * @param config - The type registry, the prompt service, the client, the approval secret, the code templates and the review overrides.
 * @returns The template service.
 */
export function openRouterTemplateService(config: OpenRouterTemplateServiceConfig): OpenRouterTemplateService {
  const { typeConfigService, promptService, client, approvalSecret } = config;
  const reviewDefinition = config.review?.definition ?? openRouterTemplateReviewPromptDefinition();
  const reviewThresholds = config.review?.thresholds;
  const codeTemplates = new Map<OpenRouterTemplateKey, OpenRouterCodeTemplate>();

  (config.codeTemplates ?? []).forEach((x) => {
    if (codeTemplates.has(x.key)) {
      throw new Error(`Duplicate code template key "${x.key}".`);
    }

    codeTemplates.set(x.key, x);
  });

  function codeTemplate(templateKey: OpenRouterTemplateKey): Maybe<OpenRouterCodeTemplate> {
    return codeTemplates.get(templateKey);
  }

  function mergeDraft(content: OpenRouterTemplateVersionContent, draft: Maybe<OpenRouterTemplateVersionContent>): OpenRouterTemplateVersionContent {
    let result = content;

    if (draft != null) {
      result = {
        script: draft.script === undefined ? content.script : draft.script,
        finalScript: draft.finalScript === undefined ? content.finalScript : draft.finalScript,
        instructions: draft.instructions === undefined ? content.instructions : draft.instructions,
        messages: draft.messages === undefined ? content.messages : draft.messages,
        config: draft.config === undefined ? content.config : draft.config,
        questions: content.questions
      };
    }

    return result;
  }

  async function loadRenderSource(params: RenderOpenRouterTemplateParams): Promise<OpenRouterTemplateRenderSource> {
    const { templateKey, version, preview } = params;
    const code = codeTemplates.get(templateKey);
    let result: OpenRouterTemplateRenderSource;

    if (code == null) {
      const draft = preview?.draft;
      let resolved: Maybe<OpenRouterResolvedPrompt>;
      let templateType: Maybe<OpenRouterTemplateTypeKey>;

      try {
        resolved = await promptService.resolvePrompt({ promptKey: templateKey, version });
        templateType = resolved.template?.type;
      } catch (e) {
        // A draft of a template that has no version yet still previews: its type comes from the prompt itself.
        if (draft == null) {
          throw e;
        }

        templateType = (await promptService.loadPrompt(templateKey))?.tt;
      }

      if (templateType == null) {
        throw new OpenRouterTemplateRenderError(`OpenRouter prompt "${templateKey}" is not a message template.`);
      }

      const typeConfig = typeConfigService.configForTemplateType(templateType);
      const storedContent: OpenRouterTemplateVersionContent = resolved == null ? {} : openRouterTemplateVersionContentForResolvedPrompt(resolved);
      const content = mergeDraft(storedContent, draft);
      const prompt: OpenRouterResolvedPrompt = { promptKey: templateKey, version: resolved?.version ?? 0, instructions: content.instructions, messages: content.messages, config: content.config ?? {} };

      if (draft == null && resolved != null && openRouterTemplateVersionHasCode(content) && !verifyTemplateVersionApproval(resolved)) {
        throw new OpenRouterTemplateRenderError(`OpenRouter template "${templateKey}" version ${resolved.version} is not approved, or was changed after it was approved.`);
      }

      result = { source: 'store', templateKey, typeConfig, prompt, content, version: draft == null ? resolved?.version : undefined };
    } else {
      const prompt = code.promptKey != null && isOpenRouterTemplateModeWithModel(code.type.mode) ? await promptService.resolvePrompt({ promptKey: code.promptKey, version }) : undefined;
      result = { source: 'code', templateKey, typeConfig: code.type, prompt, content: { instructions: prompt?.instructions, messages: prompt?.messages, config: prompt?.config }, codeTemplate: code, version: prompt?.version };
    }

    return result;
  }

  async function renderSource(renderSourceConfig: OpenRouterTemplateRenderSource, params: RenderOpenRouterTemplateParams): Promise<OpenRouterTemplateRenderResult> {
    const { source, templateKey, typeConfig, prompt, content, codeTemplate: code, version } = renderSourceConfig;
    const { preview, trace } = params;
    const { mode } = typeConfig;

    // Step 3: the shape rules. A code template's parts were checked when it was created; its prompt's config still is here.
    const shape = source === 'store' ? checkOpenRouterTemplateVersionShape(typeConfig, content) : checkOpenRouterTemplateVersionShape(typeConfig, { ...content, script: isOpenRouterTemplateModeWithBody(mode) ? 'render' : undefined, finalScript: code?.finalize == null ? undefined : 'finalize' });

    if (!shape.valid) {
      throw new OpenRouterTemplateRenderError(`OpenRouter template "${templateKey}" can't be rendered: ${shape.errors.join(' ')}`);
    }

    // Step 5: compile both scripts. Compiling re-validates them against the type as it is now.
    const outputJsonSchema = openRouterTemplateOutputJsonSchema(content.config);
    const bodyScript = source === 'store' && hasOpenRouterTemplateText(content.script) ? compileOpenRouterTemplateScript({ code: content.script, typeConfig, phase: 'body' }) : undefined;
    const finalScript = source === 'store' && hasOpenRouterTemplateText(content.finalScript) ? compileOpenRouterTemplateScript({ code: content.finalScript, typeConfig, phase: 'final', outputJsonSchema }) : undefined;
    const hasFinal = finalScript != null || code?.finalize != null;

    // Step 6: build the context. Preview swaps in loader data for the real loaders.
    const loaderOverrides = preview == null ? undefined : (preview.loaderData ?? typeConfig.samples?.loaders);
    const bodyContext = isOpenRouterTemplateModeWithBody(mode) ? openRouterTemplateContext({ typeConfig, input: params.input, loaderOverrides }) : undefined;

    // Step 7: run the body and classify its result per mode.
    let bodyRead: OpenRouterTemplateBodyResultRead;

    if (bodyContext == null) {
      bodyRead = { kind: 'openrouter', openRouter: { input: '' } };
    } else {
      const bodyResult = bodyScript == null ? await code?.render?.(bodyContext) : await bodyScript(bodyContext);
      bodyRead = readOpenRouterTemplateBodyResult(bodyResult, mode);
    }

    let text: Maybe<string>;
    let openRouterInput: Maybe<string>;
    let modelCalled = false;
    let finalized = false;
    let openRouter: Maybe<OpenRouterTemplateRenderOpenRouterDetails>;
    let modelOutput: Maybe<OpenRouterTemplateModelOutput>;

    if (bodyRead.kind === 'text') {
      text = bodyRead.text;
    } else if (bodyRead.kind === 'openrouter') {
      if (prompt == null) {
        throw new OpenRouterTemplateRenderError(`OpenRouter template "${templateKey}" has no prompt to call the model with.`);
      }

      const openRouterParams = mode === OpenRouterTemplateMode.OPENROUTER ? params.openRouter : undefined;
      let input: Maybe<OpenRouterInput>;

      if (mode === OpenRouterTemplateMode.OPENROUTER) {
        input = openRouterParams?.input;
      } else {
        const inputError = checkOpenRouterTemplateOpenRouterInput(bodyRead.openRouter.input, typeConfig.output.maxOpenRouterInputLength);

        if (inputError != null) {
          throw new OpenRouterTemplateRenderError(inputError);
        }

        openRouterInput = bodyRead.openRouter.input;
        input = openRouterInput;
      }

      // Step 8: the model call, unless a preview stops before it.
      if (preview == null || preview.callModel === true) {
        const request = openRouterPromptRequest({ prompt, input, overrides: openRouterParams?.configOverrides, files: openRouterParams?.files, trace: openRouterParams?.trace ?? trace });
        const result = await callModelForOpenRouterRequest({ client, request, tools: openRouterParams?.tools ?? undefined });

        if (result.error != null || result.outputText == null) {
          throw new OpenRouterTemplateRenderError(`The model call failed: ${result.error?.message ?? result.error?.code ?? 'the model returned no text.'}`);
        }

        modelCalled = true;
        openRouter = { generationIds: result.generationIds, usage: result.usage, model: result.model };
        modelOutput = { text: result.outputText, json: outputJsonSchema == null ? undefined : (result.outputJson ?? parseOpenRouterJsonOutput(result.outputText)) };
      } else {
        modelOutput = preview.modelOutput ?? typeConfig.samples?.output;
      }

      if (modelOutput != null) {
        // Step 9: the final script turns the model output into the text. Without one, the output text is the text.
        if (hasFinal) {
          const json = outputJsonSchema == null || modelOutput.json == null ? undefined : copyOpenRouterTemplateJsonOutput(modelOutput.json, outputJsonSchema);
          const finalContext = openRouterTemplateFinalContext(mode === OpenRouterTemplateMode.OPENROUTER ? undefined : bodyContext, { text: modelOutput.text, json });
          const finalResult = finalScript == null ? await code?.finalize?.(finalContext) : await finalScript(finalContext);
          const finalRead = readOpenRouterTemplateBodyResult(finalResult, mode, 'final');
          text = finalRead.kind === 'text' ? finalRead.text : undefined;
          finalized = true;
        } else {
          text = modelOutput.text;
        }
      }
    }

    // Step 10: the output checks on the final text.
    let empty = false;

    if (bodyRead.kind === 'empty' || (modelOutput != null && (text == null || text.trim() === ''))) {
      empty = true;
      text = undefined;
    } else if (text != null) {
      const check = checkOpenRouterTemplateOutputText({ text, maxLength: typeConfig.output.maxLength, allowedUrlDomains: typeConfig.output.allowedUrlDomains });

      if (!check.valid) {
        throw new OpenRouterTemplateOutputError(check.errors);
      }

      text = check.text;
    }

    return {
      text,
      empty,
      templateKey,
      version,
      templateType: typeConfig.type,
      mode,
      path: bodyRead.kind,
      finalized,
      source,
      openRouterInput,
      modelCalled,
      openRouter,
      metrics: text == null ? undefined : smsTextSegmentDetails(text)
    };
  }

  async function renderTemplate(params: RenderOpenRouterTemplateParams): Promise<OpenRouterTemplateRenderResult> {
    // Steps 1, 2 and 4: resolve the template, look up its type, and verify the approval of a stored version with code.
    const source = await loadRenderSource(params);
    return renderSource(source, params);
  }

  async function reviewTemplateVersion(typeConfig: OpenRouterTemplateTypeConfig, content: OpenRouterTemplateVersionContent, sampleText: Maybe<string>): Promise<OpenRouterTemplateReviewRecord> {
    const state = openRouterTemplateReviewState({ typeConfig, script: content.script, finalScript: content.finalScript, instructions: content.instructions, messages: content.messages, sampleText });
    // Asked through the code definition directly rather than resolved from the store, so a Firestore edit can't weaken it.
    const request = openRouterDecisionRequest({ prompt: reviewDefinition, state: { ...state }, questions: openRouterTemplateReviewQuestions(typeConfig) });
    const result = await openRouterDecision({ client, request });
    const answers = result.answers as Record<string, Parameters<typeof readOpenRouterTemplateReviewVerdict>[0][string]>;
    const verdict = readOpenRouterTemplateReviewVerdict(answers, reviewThresholds);
    const nouls: Record<string, number> = {};

    Object.entries(answers).forEach(([id, answer]) => {
      nouls[id] = answer?.type === 'noul' && Number.isFinite(answer.noul) ? answer.noul : 1;
    });

    return { answers: nouls, flagged: verdict.flagged, promptVersion: reviewDefinition.version, model: result.model, at: new Date().toISOString() };
  }

  async function validateTemplateVersion(params: ValidateOpenRouterTemplateVersionParams): Promise<OpenRouterTemplateVersionValidation> {
    const { typeConfig, content } = params;
    const shape = checkOpenRouterTemplateVersionShape(typeConfig, content);
    const errors = [...shape.errors];
    const warnings = [...shape.warnings];
    const outputJsonSchema = openRouterTemplateOutputJsonSchema(content.config);
    let scriptErrors: Maybe<OpenRouterTemplateScriptError[]>;
    let finalScriptErrors: Maybe<OpenRouterTemplateScriptError[]>;
    let review: Maybe<OpenRouterTemplateReviewRecord>;
    let flagged: Maybe<string[]>;

    if (content.script != null && isOpenRouterTemplateModeWithBody(typeConfig.mode)) {
      const validation = validateOpenRouterTemplateScript({ code: content.script, typeConfig, phase: 'body' });
      scriptErrors = validation.valid ? undefined : validation.errors;
    }

    if (content.finalScript != null && typeConfig.mode !== OpenRouterTemplateMode.DETERMINISTIC && typeConfig.finalScript != null) {
      const validation = validateOpenRouterTemplateScript({ code: content.finalScript, typeConfig, phase: 'final', outputJsonSchema });
      finalScriptErrors = validation.valid ? undefined : validation.errors;
    }

    let valid = errors.length === 0 && scriptErrors == null && finalScriptErrors == null;

    if (valid && params.review === true && openRouterTemplateVersionHasCode(content)) {
      let sampleText: Maybe<string>;

      if (typeConfig.samples != null) {
        try {
          const sample = await renderSource(
            { source: 'store', templateKey: '', typeConfig, content, prompt: { promptKey: '', version: 0, instructions: content.instructions, messages: content.messages, config: content.config ?? {} } },
            { templateKey: '', input: typeConfig.samples.input, preview: { callModel: false } }
          );
          sampleText = sample.text ?? (sample.empty ? '(no message)' : undefined);
        } catch (e) {
          warnings.push(`The type's samples could not be rendered: ${(e as Error).message}`);
        }
      }

      review = await reviewTemplateVersion(typeConfig, content, sampleText);

      if (review.flagged.length > 0) {
        flagged = review.flagged;
        valid = false;
      }
    }

    return { valid, errors, warnings, scriptErrors, finalScriptErrors, flagged, review };
  }

  async function previewTemplate(params: PreviewOpenRouterTemplateServiceParams): Promise<PreviewOpenRouterTemplateResult> {
    const { templateKey, version, draft, loaderData, modelOutput, callModel } = params;
    const errors: string[] = [];
    const warnings: string[] = [];
    let validation: Maybe<OpenRouterTemplateVersionValidation>;
    let output: PreviewOpenRouterTemplateResult['output'];

    try {
      const source = await loadRenderSource({ templateKey, version, preview: { draft } });

      if (source.source === 'store') {
        validation = await validateTemplateVersion({ typeConfig: source.typeConfig, content: source.content, review: params.review });
        warnings.push(...validation.warnings);
      }

      if (validation == null || validation.valid) {
        const input = params.input ?? source.typeConfig.samples?.input;
        const result = await renderSource(source, { templateKey, version, input, preview: { loaderData, callModel, modelOutput, draft } });
        const metrics = result.metrics ?? smsTextSegmentDetails('');
        output = { text: result.text, empty: result.empty, path: result.path, openRouterInput: result.openRouterInput, modelCalled: result.modelCalled, finalized: result.finalized, length: metrics.length, encoding: metrics.encoding, segments: metrics.segments };
      }
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e));
      const scriptErrors = (e as Maybe<{ readonly errors?: unknown }>)?.errors;

      if (e instanceof OpenRouterTemplateRenderError && Array.isArray(scriptErrors) && scriptErrors.every((x) => typeof x === 'object')) {
        errors.push(...(scriptErrors as OpenRouterTemplateScriptError[]).map((x) => x.message));
      }
    }

    return {
      valid: errors.length === 0 && (validation == null || validation.valid),
      errors: [...(validation?.errors ?? []), ...errors],
      warnings,
      scriptErrors: validation?.scriptErrors,
      finalScriptErrors: validation?.finalScriptErrors,
      flagged: validation?.flagged,
      review: validation?.review,
      output
    };
  }

  function approveTemplateVersion(input: OpenRouterTemplateApprovalInput): OpenRouterTemplateApproval {
    return { approvalHash: signOpenRouterTemplateApproval(approvalSecret, input), approvedAt: new Date() };
  }

  function verifyTemplateVersionApproval(resolved: OpenRouterResolvedPrompt): boolean {
    return verifyOpenRouterTemplateApproval(approvalSecret, openRouterTemplateApprovalInputForResolvedPrompt(resolved), resolved.template?.approvalHash);
  }

  return { typeConfigService, codeTemplate, renderTemplate, previewTemplate, validateTemplateVersion, approveTemplateVersion, verifyTemplateVersionApproval };
}
