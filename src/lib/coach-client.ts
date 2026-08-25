import {
  COACH_RESPONSE_SCHEMA,
  COACH_SYSTEM_PROMPT,
  buildCoachUserMessage,
  CoachRequestInput,
} from './coach-prompt';
import { CoachResponseError, CoachWeek, parseCoachWeek } from './coach-plan';

/**
 * The one module that talks to the network.
 *
 * This calls the Messages API over `fetch` rather than through
 * `@anthropic-ai/sdk`: the official SDK is Node-targeted and its credential
 * chain imports `node:fs`, which Metro cannot resolve for React Native — it
 * fails the release bundle outright (DECISIONS.md). One endpoint, one POST.
 */

const ENDPOINT = 'https://api.anthropic.com/v1/messages';
const API_VERSION = '2023-06-01';

/** Per the API skill: Opus 5 unless the owner deliberately picks otherwise. */
const MODEL = 'claude-opus-5';

export interface GenerateWeekOptions extends CoachRequestInput {
  apiKey: string;
  /** Injectable for tests; defaults to global fetch. */
  fetchImpl?: typeof fetch;
}

export class CoachRequestError extends Error {}

interface ContentBlock {
  type: string;
  text?: string;
}

interface MessagesResponse {
  content?: ContentBlock[];
  stop_reason?: string;
  error?: { message?: string };
}

/** Turn a failed response into something worth reading mid-workout. */
function messageForStatus(status: number, body: string): string {
  switch (status) {
    case 401:
    case 403:
      return 'That API key was rejected. Check it in Settings → AI coach.';
    case 429:
      return 'Rate limited by the API. Wait a minute and try again.';
    case 400:
      return `The request was rejected: ${body}`;
    default:
      return status >= 500
        ? `The API is having trouble (${status}). Try again shortly.`
        : `API error ${status}: ${body}`;
  }
}

function firstText(response: MessagesResponse): string {
  for (const block of response.content ?? []) {
    if (block.type === 'text' && typeof block.text === 'string') {
      return block.text;
    }
  }
  throw new CoachResponseError('The coach returned no text to read.');
}

export async function generateCoachWeek(
  options: GenerateWeekOptions,
): Promise<CoachWeek> {
  const { apiKey, fetchImpl = fetch, ...request } = options;

  let response: Response;
  try {
    response = await fetchImpl(ENDPOINT, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': API_VERSION,
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 16000,
        system: COACH_SYSTEM_PROMPT,
        thinking: { type: 'adaptive' },
        output_config: {
          effort: 'high',
          format: { type: 'json_schema', schema: COACH_RESPONSE_SCHEMA },
        },
        messages: [{ role: 'user', content: buildCoachUserMessage(request) }],
      }),
    });
  } catch {
    throw new CoachRequestError(
      'Could not reach the API — check your connection.',
    );
  }

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new CoachRequestError(messageForStatus(response.status, body.slice(0, 200)));
  }

  let parsed: MessagesResponse;
  try {
    parsed = (await response.json()) as MessagesResponse;
  } catch {
    throw new CoachRequestError('The API returned something unreadable.');
  }

  if (parsed.stop_reason === 'refusal') {
    throw new CoachRequestError(
      'The model declined this request. Try again with a shorter log.',
    );
  }

  try {
    return parseCoachWeek(firstText(parsed), request.week);
  } catch (error) {
    throw new CoachRequestError(
      error instanceof Error ? error.message : 'Unreadable coach response.',
    );
  }
}
