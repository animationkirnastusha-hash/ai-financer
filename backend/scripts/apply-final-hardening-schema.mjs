import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const schemaPath = join(process.cwd(), 'prisma', 'schema.prisma');
let schema = readFileSync(schemaPath, 'utf8');

const relations = [
  '  aiSessionState    AISessionState?',
  '  companionEvents   AICompanionEvent[]',
  '  premiumCapabilities AIPremiumCapability[]',
  '  aiIdempotencyRecords AIIdempotencyRecord[]',
  '  aiOperationEvents AIOperationEvent[]',
];

for (const relation of relations) {
  if (!schema.includes(relation.trim())) {
    schema = schema.replace('  activities        UserActivity[]\n', `  activities        UserActivity[]\n${relation}\n`);
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

if (!schema.includes('model AIIdempotencyRecord')) {
  schema += `

model AIIdempotencyRecord {
  id          String   @id @default(cuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  key         String
  scope       String
  requestHash String?
  response    String?
  status      String   @default("completed")
  expiresAt   DateTime
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  @@unique([userId, scope, key])
  @@index([expiresAt])
  @@index([scope])
}
`;
}

if (!schema.includes('model AIOperationEvent')) {
  schema += `

model AIOperationEvent {
  id        String   @id @default(cuid())
  userId    String?
  user      User?    @relation(fields: [userId], references: [id], onDelete: SetNull)
  type      String
  severity  String   @default("info")
  scope     String?
  message   String?
  payload   String?
  createdAt DateTime @default(now())
  @@index([userId])
  @@index([type])
  @@index([severity])
  @@index([createdAt])
}
`;
}

writeFileSync(schemaPath, schema.endsWith('\n') ? schema : `${schema}\n`);
console.log('Final backend hardening schema patch applied.');
