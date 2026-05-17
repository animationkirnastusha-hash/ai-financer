import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const schemaPath = join(process.cwd(), 'prisma', 'schema.prisma');
let schema = readFileSync(schemaPath, 'utf8');

const relationLines = [
  '  aiSettings        UserAISettings?',
  '  onboardingState   OnboardingState?',
  '  aiSessionState    AISessionState?',
  '  companionEvents   AICompanionEvent[]',
  '  premiumCapabilities AIPremiumCapability[]',
];

for (const line of relationLines) {
  if (!schema.includes(line.trim())) {
    schema = schema.replace('  activities        UserActivity[]\n', `  activities        UserActivity[]\n${line}\n`);
  }
}

if (!schema.includes('model AISessionState')) {
  schema += `

model AISessionState {
  id             String   @id @default(cuid())
  userId         String   @unique
  user           User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  pendingIntent  String?
  pendingTool    String?
  pendingPayload String?
  clarification  String?
  lastCommand    String?
  lastResult     String?
  expiresAt      DateTime?
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  @@index([expiresAt])
}
`;
}

if (!schema.includes('model AICompanionEvent')) {
  schema += `

model AICompanionEvent {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  type      String
  tone      String   @default("calm")
  title     String
  message   String
  payload   String?
  seen      Boolean  @default(false)
  createdAt DateTime @default(now())
  @@index([userId])
  @@index([type])
  @@index([seen])
  @@index([createdAt])
}
`;
}

if (!schema.includes('model AIPremiumCapability')) {
  schema += `

model AIPremiumCapability {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  key       String
  enabled   Boolean  @default(false)
  source    String   @default("system")
  meta      String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  @@unique([userId, key])
  @@index([key])
  @@index([enabled])
}
`;
}

writeFileSync(schemaPath, schema.endsWith('\n') ? schema : `${schema}\n`);
console.log('Mega foundation schema patch applied.');
