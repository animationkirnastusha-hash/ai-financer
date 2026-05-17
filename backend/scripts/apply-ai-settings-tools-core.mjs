import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const schemaPath = join(process.cwd(), 'prisma', 'schema.prisma');
const routesPath = join(process.cwd(), 'src', 'routes', 'index.ts');

let schema = readFileSync(schemaPath, 'utf8');

if (!schema.includes('aiSettings        UserAISettings?')) {
  schema = schema.replace(
    '  activities        UserActivity[]\n',
    '  activities        UserActivity[]\n  aiSettings        UserAISettings?\n  onboardingState   OnboardingState?\n',
  );
}

if (!schema.includes('model UserAISettings')) {
  schema = `${schema.trim()}

model UserAISettings {
  id                              String   @id @default(cuid())
  userId                          String   @unique
  user                            User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  preset                          String   @default("balanced")
  defaultExpenseAccountId         String?
  defaultIncomeAccountId          String?
  autoConfirmExpenseLimit         Int      @default(500)
  autoConfirmIncomeLimit          Int      @default(100000)
  autoConfirmTransferLimit        Int      @default(0)
  requireConfirmForAccountActions Boolean  @default(true)
  companionTone                   String   @default("friendly")

  createdAt                       DateTime @default(now())
  updatedAt                       DateTime @updatedAt

  @@index([preset])
}

model OnboardingState {
  id          String   @id @default(cuid())
  userId      String   @unique
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  status      String   @default("not_started")
  currentStep String?
  skipped     Boolean  @default(false)
  completedAt DateTime?
  meta        String?

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([status])
}
`;
}

writeFileSync(schemaPath, schema.endsWith('\n') ? schema : `${schema}\n`);

let routes = readFileSync(routesPath, 'utf8');

if (!routes.includes("modules/ai-settings/routes")) {
  routes = routes.replace(
    "import progressionRoutes from '../modules/progression/routes';",
    "import progressionRoutes from '../modules/progression/routes';\nimport aiSettingsRoutes from '../modules/ai-settings/routes';",
  );
}

if (!routes.includes("router.use('/ai-settings', aiSettingsRoutes);")) {
  routes = routes.replace(
    "router.use('/progression', progressionRoutes);",
    "router.use('/progression', progressionRoutes);\nrouter.use('/ai-settings', aiSettingsRoutes);",
  );
}

writeFileSync(routesPath, routes);
console.log('AI settings schema/routes patch applied.');
