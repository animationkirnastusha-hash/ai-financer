import { runSmoke } from './lib/test-context.mjs';
import { requestJson } from './lib/http-client.mjs';

await runSmoke('taxonomy', async (context) => {
  const sectionResponse = await requestJson(context, '/sections', {
    method: 'POST',
    expected: [201],
    body: { name: `Smoke section ${context.suffix}`, icon: '📦', color: '#7c3aed' },
  });
  const section = sectionResponse.payload?.section;
  if (!section?.id) throw new Error('Section was not created');

  const categoryResponse = await requestJson(context, '/categories', {
    method: 'POST',
    expected: [201],
    body: {
      name: `Smoke category ${context.suffix}`,
      type: 'expense',
      icon: '🧪',
      color: '#2563eb',
      sectionId: section.id,
    },
  });
  const category = categoryResponse.payload?.category;
  if (!category?.id) throw new Error('Category was not created');
  if (category.sectionId !== section.id) throw new Error('Category sectionId mismatch');

  await requestJson(context, `/categories/${category.id}`, {
    method: 'PUT',
    body: { name: `Smoke category updated ${context.suffix}`, type: 'expense', sectionId: section.id },
  });

  context.log('taxonomy lifecycle passed', { sectionId: section.id, categoryId: category.id });
});
