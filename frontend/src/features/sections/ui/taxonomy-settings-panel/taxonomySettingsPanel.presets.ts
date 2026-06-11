import type { CategoryPreset, SectionPreset } from './taxonomySettingsPanel.types';

export const SECTION_PRESETS: SectionPreset[] = [
  {
    nameKey: 'settings.taxonomy.preset.section.home',
    icon: '🏠',
    descriptionKey: 'settings.taxonomy.preset.section.home.description',
  },
  {
    nameKey: 'settings.taxonomy.preset.section.entertainment',
    icon: '🎮',
    descriptionKey: 'settings.taxonomy.preset.section.entertainment.description',
  },
  {
    nameKey: 'settings.taxonomy.preset.section.work',
    icon: '💼',
    descriptionKey: 'settings.taxonomy.preset.section.work.description',
  },
  {
    nameKey: 'settings.taxonomy.preset.section.subscriptions',
    icon: '🔁',
    descriptionKey: 'settings.taxonomy.preset.section.subscriptions.description',
  },
];

export const CATEGORY_PRESETS: CategoryPreset[] = [
  {
    nameKey: 'settings.taxonomy.preset.category.groceries',
    icon: '🛒',
    sectionNameKey: 'settings.taxonomy.preset.section.home',
  },
  {
    nameKey: 'settings.taxonomy.preset.category.coffee',
    icon: '☕',
    sectionNameKey: 'settings.taxonomy.preset.section.entertainment',
  },
  {
    nameKey: 'settings.taxonomy.preset.category.taxi',
    icon: '🚕',
    sectionNameKey: 'settings.taxonomy.preset.section.entertainment',
  },
  {
    nameKey: 'settings.taxonomy.preset.category.salary',
    icon: '💰',
    sectionNameKey: 'settings.taxonomy.preset.section.work',
    type: 'income',
  },
];
