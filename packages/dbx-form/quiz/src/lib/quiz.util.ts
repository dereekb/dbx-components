import { type QuizQuestionTextComponentConfig } from './component/quiz.question.text.component';

/**
 * Creates a Likert scale question config with agreement prompt (Strongly Disagree to Strongly Agree).
 *
 * @param text - The statement to rate agreement on
 * @returns A quiz question config with an agreement-based prompt and guidance text
 *
 * @example
 * ```ts
 * instance.config.set(quizAgreementPrompt('I feel confident leading under pressure.'));
 * // { prompt: 'Please rate how much you agree...', text: '...', guidance: '1 = Strongly Disagree, 5 = Strongly Agree' }
 * ```
 *
 * @param text - The statement to rate agreement on
 */
export function quizAgreementPrompt(text: string): QuizQuestionTextComponentConfig {
  return {
    prompt: 'Please rate how much you agree with the following statement:',
    text,
    guidance: '1 = Strongly Disagree, 5 = Strongly Agree'
  };
}

/**
 * Creates a Likert scale question config with frequency prompt (Never to Always).
 *
 * @param text - The statement to rate frequency on
 * @returns A quiz question config with a frequency-based prompt and guidance text
 *
 * @example
 * ```ts
 * instance.config.set(quizFrequencyPrompt('I break vague direction into first steps.'));
 * // { prompt: 'Please rate how much you agree...', text: '...', guidance: '1 = Never, 5 = Always' }
 * ```
 *
 * @param text - The statement to rate frequency on
 */
export function quizFrequencyPrompt(text: string): QuizQuestionTextComponentConfig {
  return {
    prompt: 'Please rate how much you agree with the following statement:',
    text,
    guidance: '1 = Never, 5 = Always'
  };
}
