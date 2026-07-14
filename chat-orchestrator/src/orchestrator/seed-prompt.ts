/**
 * Registers the versioned chatbot.system prompt into the ai-gateway prompt
 * registry for audit/rollback (spec §5). Run once with an ADMIN token:
 *   ADMIN_TOKEN=... AI_GATEWAY_URL=... pnpm --filter chat-orchestrator seed:prompt
 */
import {
  CHATBOT_SYSTEM_PROMPT_KEY,
  CHATBOT_SYSTEM_PROMPT_TEMPLATE,
} from './system-prompt';

async function main() {
  const base = process.env.AI_GATEWAY_URL ?? 'http://localhost:8080';
  const token = process.env.ADMIN_TOKEN;
  if (!token) throw new Error('ADMIN_TOKEN env is required (an admin JWT)');

  const headers = {
    'content-type': 'application/json',
    authorization: `Bearer ${token}`,
  };

  const createRes = await fetch(`${base}/api/v1/prompts`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      key: CHATBOT_SYSTEM_PROMPT_KEY,
      task: 'chat',
      content: CHATBOT_SYSTEM_PROMPT_TEMPLATE,
      variables: ['market', 'lang'],
    }),
  });
  if (!createRes.ok) throw new Error(`create failed: ${createRes.status} ${await createRes.text()}`);
  const draft = (await createRes.json()) as { version: number };

  const pubRes = await fetch(
    `${base}/api/v1/prompts/${CHATBOT_SYSTEM_PROMPT_KEY}/${draft.version}/publish`,
    { method: 'POST', headers },
  );
  if (!pubRes.ok) throw new Error(`publish failed: ${pubRes.status}`);
  // eslint-disable-next-line no-console
  console.log(`Seeded & published ${CHATBOT_SYSTEM_PROMPT_KEY} v${draft.version}`);
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});
