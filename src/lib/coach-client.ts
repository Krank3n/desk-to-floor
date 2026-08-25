import Anthropic from '@anthropic-ai/sdk';

import {
  COACH_RESPONSE_SCHEMA,
  COACH_SYSTEM_PROMPT,
  buildCoachUserMessage,
  CoachRequestInput,
} from './coach-prompt';
import { CoachResponseError, CoachWeek, parseCoachWeek } from './coach-plan';

/**
 * The one module that talks to the network. Everything it depends on — prompt
 * construction and response validation — is pure and tested separately, so
 * this stays thin enough to read in one go.
 */

/** Per the API skill: Opus 5 unless the owner deliberately picks otherwise. */
const MODEL = 'claude-opus-5';

export interface GenerateWeekOptions extends CoachRequestInput {
  apiKey: string;
}

function firstTextBlock(message: Anthropic.Message): string {
  for (const block of message.content) {
    if (block.type === 'text') return block.text;
  }
  throw new CoachResponseError('The coach returned no text to read.');
}

/** Turn SDK failures into something worth showing on a phone mid-workout. */
function describeError(error: unknown): string {
  if (error instanceof Anthropic.AuthenticationError) {
    return 'That API key was rejected. Check it in Settings → AI coach.';
  }
  if (error instanceof Anthropic.RateLimitError) {
    return 'Rate limited by the API. Wait a minute and try again.';
  }
  if (error instanceof Anthropic.BadRequestError) {
    return `The request was rejected: ${error.message}`;
  }
  if (error instanceof Anthropic.APIConnectionError) {
    return 'Could not reach the API — check your connection.';
  }
  if (error instanceof Anthropic.APIError) {
    return `API error ${error.status}: ${error.message}`;
  }
  if (error instanceof CoachResponseError) return error.message;
  return error instanceof Error ? error.message : 'Unknown error.';
}

export class CoachRequestError extends Error {}

export async function generateCoachWeek(
  options: GenerateWeekOptions,
): Promise<CoachWeek> {
  const { apiKey, ...request } = options;
  const client = new Anthropic({
    apiKey,
    // Single-user app: the owner's own key, on the owner's own device, in the
    // platform keystore. There is no server to proxy through in v1 — see
    // DECISIONS.md before shipping this to anyone else.
    dangerouslyAllowBrowser: true,
  });

  try {
    const message = await client.messages.create({
      model: MODEL,
      max_tokens: 16000,
      system: COACH_SYSTEM_PROMPT,
      thinking: { type: 'adaptive' },
      output_config: {
        effort: 'high',
        format: {
          type: 'json_schema',
          schema: COACH_RESPONSE_SCHEMA as unknown as Record<string, unknown>,
        },
      },
      messages: [{ role: 'user', content: buildCoachUserMessage(request) }],
    });

    if (message.stop_reason === 'refusal') {
      throw new CoachResponseError(
        'The model declined this request. Try again with a shorter log.',
      );
    }
    return parseCoachWeek(firstTextBlock(message), request.week);
  } catch (error) {
    throw new CoachRequestError(describeError(error));
  }
}
