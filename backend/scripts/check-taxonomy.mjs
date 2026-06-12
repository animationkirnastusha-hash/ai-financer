import { runSmoke } from './lib/test-context.mjs';
import { requestJson, unwrapArray } from './lib/http-client.mjs';

function assertEntity(entity, label) {
  if (!entity?.id) throw new Error(`${label}: id is missing`);
  if (!entity?.name) throw new Error(`${label}: name is missing`);
}

function assertAppearance(entity, label) {
  assertEntity(entity, label);
  if (!entity.icon) throw new Error(`${label}: icon is missing`);
  if (!entity.color) throw new Error(`${label}: color is missing`);
}

await runSmoke('taxonomy-crud', async (context) => {
  const sectionName = `Smoke раздел ${context.suffix}`;
  const sectionUpdatedName = `Smoke раздел обновлён ${context.suffix}`;
  const categoryName = `Smoke категория ${context.suffix}`;
  const categoryUpdatedName = `Smoke категория обновлена ${context.suffix}`;

  const sectionCreateResponse = await requestJson(context, '/sections', {
    method: 'POST',
    expected: [201],
    body: {
      name: sectionName,
    },
  });

  const section = sectionCreateResponse.payload?.section;
  assertAppearance(section, 'created section');

  const sectionsListResponse = await requestJson(context, '/sections');
  const sections = unwrapArray(sectionsListResponse.payload, 'sections');
  if (!sections.some((item) => item.id === section.id)) {
    throw new Error('Created section is not visible on /sections');
  }

  const sectionUpdateResponse = await requestJson(context, `/sections/${section.id}`, {
    method: 'PUT',
    body: {
      name: sectionUpdatedName,
    },
  });

  const updatedSection = sectionUpdateResponse.payload?.section;
  assertAppearance(updatedSection, 'updated section');
  if (updatedSection.name !== sectionUpdatedName) {
    throw new Error(`Section name was not updated: ${updatedSection.name}`);
  }

  const categoryCreateResponse = await requestJson(context, '/categories', {
    method: 'POST',
    expected: [201],
    body: {
      name: categoryName,
      type: 'expense',
      sectionId: section.id,
    },
  });

  const category = categoryCreateResponse.payload?.category;
  assertAppearance(category, 'created category');
  if (category.sectionId !== section.id) {
    throw new Error(`Category was not attached to section: ${category.sectionId}`);
  }

  const categoriesListResponse = await requestJson(context, '/categories');
  const categories = unwrapArray(categoriesListResponse.payload, 'categories');
  if (!categories.some((item) => item.id === category.id)) {
    throw new Error('Created category is not visible on /categories');
  }

  const categoryUpdateResponse = await requestJson(context, `/categories/${category.id}`, {
    method: 'PUT',
    body: {
      name: categoryUpdatedName,
      type: 'expense',
      sectionId: section.id,
    },
  });

  const updatedCategory = categoryUpdateResponse.payload?.category;
  assertAppearance(updatedCategory, 'updated category');
  if (updatedCategory.name !== categoryUpdatedName) {
    throw new Error(`Category name was not updated: ${updatedCategory.name}`);
  }
  if (updatedCategory.sectionId !== section.id) {
    throw new Error(`Updated category lost section link: ${updatedCategory.sectionId}`);
  }

  await requestJson(context, `/categories/${category.id}`, {
    method: 'DELETE',
  });

  await requestJson(context, `/sections/${section.id}`, {
    method: 'DELETE',
  });

  context.log('taxonomy crud flow passed', {
    sectionId: section.id,
    categoryId: category.id,
  });
});
