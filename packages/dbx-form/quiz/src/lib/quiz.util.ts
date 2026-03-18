import { type QuizQuestionTextComponentConfig } from './component/quiz.question.text.component';

/**
 * Creates a Likert scale question config with agreement prompt (Strongly Disagree to Strongly Agree).
 *
 * @example
 * ```ts
 * instance.config.set(quizAgreementPrompt('I feel confident leading under pressure.'));
 * // { prompt: 'Please rate how much you agree...', text: '...', guidance: '1 = Strongly Disagree, 5 = Strongly Agree' }
 * ```
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
 * @example
 * ```ts
 * instance.config.set(quizFrequencyPrompt('I break vague direction into first steps.'));
 * // { prompt: 'Please rate how much you agree...', text: '...', guidance: '1 = Never, 5 = Always' }
 * ```
 */
export function quizFrequencyPrompt(text: string): QuizQuestionTextComponentConfig {
  return {
    prompt: 'Please rate how much you agree with the following statement:',
    text,
    guidance: '1 = Never, 5 = Always'
  };
}
