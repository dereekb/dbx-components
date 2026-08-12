import { type OpenRouterModelConfig, type OpenRouterPromptKey, openRouterFileParserPlugin } from '@dereekb/openrouter';

/**
 * The demo's one OpenRouter prompt: given a PDF, decide whether it is a resume.
 *
 * The key is the document id, so a call site names the prompt in readable text rather than quoting an
 * opaque vendor id.
 */
export const DEMO_RESUME_CHECK_PROMPT_KEY: OpenRouterPromptKey = 'demo-resume-check';

/**
 * Human-readable name for {@link DEMO_RESUME_CHECK_PROMPT_KEY}.
 */
export const DEMO_RESUME_CHECK_PROMPT_NAME = 'Demo Resume Check';

/**
 * Default model the demo runs the resume check on.
 *
 * A free model, so a live run costs nothing. The server-side seeder overrides it from
 * `OPENROUTER_TEST_MODEL_ID` — the same knob the openrouter package's own live specs read — which is
 * read there rather than here because this file is shared with the browser build.
 */
export const DEMO_RESUME_CHECK_DEFAULT_MODEL_ID = 'nvidia/nemotron-nano-9b-v2:free';

/**
 * The system prompt for {@link DEMO_RESUME_CHECK_PROMPT_KEY}.
 *
 * The JSON shape is named in the instructions rather than enforced through a response format, because
 * the demo deliberately runs against whatever model `OPENROUTER_TEST_MODEL_ID` names, and structured
 * output is not universally supported. {@link demoResumeCheckVerdictFromOutput} is the tolerant reader
 * that closes the gap.
 */
export const DEMO_RESUME_CHECK_INSTRUCTIONS = ['You inspect an attached document and decide whether it is a resume (also called a CV).', "A resume lists a single person's work history, education, or skills.", 'Answer with JSON only, in exactly this shape: {"isResume": boolean, "reason": string}.', 'Keep "reason" to one short sentence.'].join(' ');

/**
 * Model config for {@link DEMO_RESUME_CHECK_PROMPT_KEY}.
 *
 * The `file-parser` plugin is not optional here: a prompt that attaches a PDF without it gets NO
 * warning at all (validation only warns when the plugin is present and its engine is unpinned), and the
 * pinned `native` engine is what avoids OpenRouter's silent `mistral-ocr` fallback — an 8-image cap and
 * per-page billing, applied without an error to notice.
 *
 * @param modelId - Model to run against. Defaults to {@link DEMO_RESUME_CHECK_DEFAULT_MODEL_ID}.
 * @returns The model config.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function demoResumeCheckPromptConfig(modelId: string = DEMO_RESUME_CHECK_DEFAULT_MODEL_ID): OpenRouterModelConfig {
  return {
    model: modelId,
    // Generous on purpose: a hybrid reasoning model spends output tokens on reasoning first, so a tight
    // cap truncates the answer away and leaves an otherwise-fine run with no text.
    maxOutputTokens: 2048,
    plugins: [openRouterFileParserPlugin()]
  };
}

/**
 * The model's verdict about one document.
 */
export interface DemoResumeCheckVerdict {
  readonly isResume: boolean;
  readonly reason: string;
}

/**
 * Reads a verdict out of a run task's parsed JSON output, falling back to its text.
 *
 * Tolerant by design: the demo runs against whatever model is configured, and a model that ignores the
 * "JSON only" instruction and wraps its answer in prose should still produce a usable verdict rather
 * than fail the file.
 *
 * @param outputJson - The run task's parsed JSON output, when it parsed.
 * @param outputText - The run task's raw output text.
 * @returns The verdict, or undefined when neither yielded one.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function demoResumeCheckVerdictFromOutput(outputJson: unknown, outputText: unknown): DemoResumeCheckVerdict | undefined {
  const parsed = demoResumeCheckVerdictFromValue(outputJson) ?? demoResumeCheckVerdictFromValue(demoResumeCheckJsonInText(outputText));
  return parsed;
}

function demoResumeCheckJsonInText(outputText: unknown): unknown {
  let result: unknown;

  if (typeof outputText === 'string') {
    const start = outputText.indexOf('{');
    const end = outputText.lastIndexOf('}');

    if (start >= 0 && end > start) {
      try {
        result = JSON.parse(outputText.slice(start, end + 1));
      } catch {
        result = undefined;
      }
    }
  }

  return result;
}

function demoResumeCheckVerdictFromValue(value: unknown): DemoResumeCheckVerdict | undefined {
  let result: DemoResumeCheckVerdict | undefined;

  if (value != null && typeof value === 'object') {
    const candidate = value as { isResume?: unknown; reason?: unknown };

    if (typeof candidate.isResume === 'boolean') {
      result = { isResume: candidate.isResume, reason: typeof candidate.reason === 'string' ? candidate.reason : '' };
    }
  }

  return result;
}
