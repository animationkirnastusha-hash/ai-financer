import assert from 'node:assert/strict';
import test from 'node:test';
import { prisma } from '../../../lib/prisma';
import { aiIdempotencyService } from '../ai-idempotency.service';
import { AIResponseNormalizerService } from '../ai-response-normalizer.service';
import { companionFacadeService } from '../../companion/service';
import { aiPremiumService } from '../ai-premium.service';

async function resetDb() {
  await prisma.aIIdempotencyRecord.deleteMany();
  await prisma.aIOperationEvent.deleteMany();
  await prisma.aICompanionEvent.deleteMany();
  await prisma.aIPremiumCapability.deleteMany();
  await prisma.progressionProfile.deleteMany();
  await prisma.userAISettings.deleteMany();
  await prisma.onboardingState.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.account.deleteMany();
  await prisma.user.deleteMany();
}

async function createUser() {
  return prisma.user.create({
    data: {
      telegramId: BigInt(Date.now() + Math.floor(Math.random() * 100000)),
      firstName: 'Test',
      username: `hardening_${Math.floor(Math.random() * 1000000)}`,
    },
  });
}

test.after(async () => {
  await prisma.$disconnect();
});

test('hardening: idempotency stores and returns response', async () => {
  await resetDb();
  const user = await createUser();
  const hash = aiIdempotencyService.hashPayload({ a: 1 });

  await aiIdempotencyService.save(user.id, 'test', 'key1', hash, { ok: true });

  const existing = await aiIdempotencyService.get(user.id, 'test', 'key1', hash);

  assert.equal(existing?.conflict, false);
  assert.deepEqual(existing?.response, { ok: true });
});

test('hardening: response normalizer returns frontend-safe shape', () => {
  const normalized = new AIResponseNormalizerService().normalize({
    success: true,
    intent: 'batch',
    executed: false,
    requiresConfirmation: true,
    riskLevel: 'medium',
    message: 'Проверь',
    parsed: null,
  });

  assert.equal(normalized.success, true);
  assert.equal(normalized.intent, 'batch');
  assert.equal(normalized.riskLevel, 'medium');
  assert.equal(typeof normalized.meta, 'object');
});

test('hardening: companion state exposes quiet UX fields', async () => {
  await resetDb();
  const user = await createUser();

  await prisma.userAISettings.create({
    data: { userId: user.id, companionTone: 'friendly' },
  });

  const state = await companionFacadeService.getState(user.id);

  assert.equal(state.tone, 'friendly');
  assert.equal(typeof state.suggestedMessage, 'string');
  assert.equal(state.tier, 'FREE');
});

test('hardening: premium capabilities keep free base enabled and premium depth gated', async () => {
  await resetDb();
  const user = await createUser();

  const result = await aiPremiumService.getCapabilities(user.id);

  assert.equal(result.tier, 'FREE');
  assert.ok(result.capabilities.some((item) => item.key === 'basic_ai_control' && item.enabled));
  assert.ok(result.capabilities.some((item) => item.key === 'advanced_memory' && !item.enabled));
});
