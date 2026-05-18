
import { getHomeState } from '@/features/home-state/useHomeState';

export default function HomePage() {

  const state = getHomeState({
    accountsCount: 0,
    transactionsCount: 0,
  });

  if (state === 'NEW_USER') {
    return (
      <div className='min-h-screen bg-black text-white p-8'>
        <div className='max-w-md mx-auto space-y-6'>
          <div className='text-sm opacity-50'>
            AI Companion
          </div>

          <h1 className='text-5xl font-semibold leading-tight'>
            Давай настроим
            <br />
            твою финансовую систему.
          </h1>

          <button className='w-full rounded-3xl bg-white text-black py-4'>
            Создать первый счет
          </button>

          <div className='space-y-3 pt-4'>

            <div className='rounded-3xl border border-white/10 p-5'>
              1. Создай первый счет
            </div>

            <div className='rounded-3xl border border-white/10 p-5 opacity-50'>
              2. Добавь деньги
            </div>

            <div className='rounded-3xl border border-white/10 p-5 opacity-50'>
              3. Запиши расход
            </div>

            <div className='rounded-3xl border border-white/10 p-5 opacity-50'>
              4. Спроси AI
            </div>

          </div>
        </div>
      </div>
    );
  }

  return (
    <div className='min-h-screen bg-black text-white p-8'>
      Dashboard
    </div>
  );
}
