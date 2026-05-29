import { useAuthStore } from '@/features/auth/model/auth.store';
import { useNavigationStore } from '@/features/navigation/model/navigation.store';
import { ScreenTopBar } from '@/shared/ui/ScreenTopBar';

type ProfileCard = {
  title: string;
  caption: string;
  bullets: string[];
};

type WorkZone = {
  title: string;
  caption: string;
  state: 'available' | 'soon' | 'important';
};

const profileCards: ProfileCard[] = [
  {
    title: 'Самозанятый',
    caption: 'Простой учёт доходов, расходов, чеков и напоминаний без тяжёлой бухгалтерии.',
    bullets: ['доходы по клиентам', 'напоминания о налоге', 'экспорт для себя'],
  },
  {
    title: 'ИП',
    caption: 'Бизнес-кошелёк отдельно от личных финансов, дедлайны и подготовка данных для отчётов.',
    bullets: ['налоговый календарь', 'расходы бизнеса', 'выгрузка для бухгалтера'],
  },
  {
    title: 'Малый бизнес',
    caption: 'Контроль регулярных платежей, документов, оборота и первичной картины по деньгам.',
    bullets: ['документы', 'сводка по обороту', 'риски кассовых разрывов'],
  },
];

const workZones: WorkZone[] = [
  {
    title: 'Налоги и дедлайны',
    caption: 'Календарь платежей, напоминания и предварительная оценка будущей нагрузки.',
    state: 'soon',
  },
  {
    title: 'Доходы бизнеса',
    caption: 'Разделение личных денег и бизнес-доходов, клиенты, источники, повторяемость.',
    state: 'soon',
  },
  {
    title: 'Расходы бизнеса',
    caption: 'Категории для бизнеса, чеки, подписки, аренда, связь, реклама и материалы.',
    state: 'soon',
  },
  {
    title: 'Документы',
    caption: 'Место для актов, чеков, счетов и будущего распознавания документов.',
    state: 'soon',
  },
  {
    title: 'Отчёты',
    caption: 'Экспорт данных для себя или бухгалтера без ручной сборки таблиц.',
    state: 'available',
  },
  {
    title: 'Осторожный режим',
    caption: 'Фина готовит данные и подсвечивает риски, но не заменяет юридическую консультацию.',
    state: 'important',
  },
];

const accountingAreas = [
  'Профиль бизнеса',
  'Налоговый режим',
  'Доходы бизнеса',
  'Расходы бизнеса',
  'Налоговые напоминания',
  'Документы',
  'Отчёты',
  'Экспорт для бухгалтера',
];

function StateBadge({ state }: { state: WorkZone['state'] }) {
  const label = state === 'available' ? 'готово' : state === 'important' ? 'важно' : 'скоро';
  return <span className={`business-admin-badge business-admin-badge--${state}`}>{label}</span>;
}

function AdminOnlyFallback() {
  const goHome = useNavigationStore((state) => state.goHome);

  return (
    <div className="app-page text-white">
      <div className="app-page__inner space-y-4">
        <ScreenTopBar title="ИИ-бухгалтер" left="back" right={['home']} />
        <section className="app-card app-card--hero">
          <div className="app-eyebrow">Скоро</div>
          <h1 className="app-hero-title">Фина Бухгалтер готовится</h1>
          <p className="app-hero-caption">Раздел для самозанятых, ИП и малого бизнеса появится отдельно от личных финансов.</p>
          <button type="button" className="app-primary-button mt-4" onClick={goHome}>На главную</button>
        </section>
      </div>
    </div>
  );
}

export default function BusinessAccountantPage() {
  const isAdmin = Boolean(useAuthStore((state) => state.user?.isAdmin));
  const navigateTo = useNavigationStore((state) => state.navigateTo);

  if (!isAdmin) return <AdminOnlyFallback />;

  return (
    <div className="app-page business-admin-page text-white">
      <div className="app-page__inner space-y-4">
        <ScreenTopBar title="ИИ-бухгалтер" left="back" right={['home', 'settings']} />

        <header className="business-admin-hero">
          <div className="business-admin-hero__orb" aria-hidden="true" />
          <div className="business-admin-kicker">Фина Бухгалтер</div>
          <h1>Для ИП, самозанятых и малого бизнеса</h1>
          <p>
            Отдельное направление поверх личных финансов: доходы, расходы бизнеса, документы, сроки и отчёты без смешивания с личными деньгами.
          </p>
          <div className="business-admin-hero__actions">
            <button type="button" className="app-primary-button" onClick={() => navigateTo('premium')}>К Premium</button>
            <button type="button" className="app-secondary-button" onClick={() => navigateTo('admin')}>Админка</button>
          </div>
        </header>

        <section className="business-admin-warning">
          <b>Позиционирование</b>
          <span>Фина помогает вести учёт, готовить данные и видеть сроки. Она не заменяет бухгалтера и не обещает юридическую гарантию расчётов.</span>
        </section>

        <section className="business-admin-profile-grid">
          {profileCards.map((card) => (
            <article key={card.title} className="business-admin-profile-card">
              <div className="business-admin-profile-card__icon">{card.title.slice(0, 1)}</div>
              <h2>{card.title}</h2>
              <p>{card.caption}</p>
              <div>
                {card.bullets.map((bullet) => <span key={bullet}>{bullet}</span>)}
              </div>
            </article>
          ))}
        </section>

        <section className="app-card business-admin-section">
          <div className="business-admin-section__head">
            <div>
              <div className="app-eyebrow">Модули</div>
              <h2>Что будет внутри</h2>
            </div>
            <span>отдельный режим</span>
          </div>
          <div className="business-admin-zone-list">
            {workZones.map((zone) => (
              <article key={zone.title} className="business-admin-zone-card">
                <div>
                  <h3>{zone.title}</h3>
                  <p>{zone.caption}</p>
                </div>
                <StateBadge state={zone.state} />
              </article>
            ))}
          </div>
        </section>

        <section className="app-card business-admin-section">
          <div className="business-admin-section__head">
            <div>
              <div className="app-eyebrow">Сценарий</div>
              <h2>Как это должно ощущаться</h2>
            </div>
          </div>
          <div className="business-admin-flow">
            <div><strong>1</strong><span>Пользователь выбирает статус: самозанятый, ИП или малый бизнес.</span></div>
            <div><strong>2</strong><span>Фина разделяет личные и бизнес-деньги, не смешивая счета и категории.</span></div>
            <div><strong>3</strong><span>Приложение напоминает о сроках, готовит отчёты и показывает риски.</span></div>
          </div>
        </section>

        <section className="app-card business-admin-section">
          <div className="business-admin-section__head">
            <div>
              <div className="app-eyebrow">Учёт</div>
              <h2>Что Фина будет учитывать</h2>
            </div>
          </div>
          <div className="business-admin-roadmap">
            {accountingAreas.map((item) => <span key={item}>{item}</span>)}
          </div>
        </section>
      </div>
    </div>
  );
}
