import type { Idea, RawPost } from '@/types';
import rawPosts from './seed_posts.json';

/** Реальный корпус (289 постов) — дефолтные данные дашборда. */
export const seedPosts = rawPosts as RawPost[];

/** Демонстрационные идеи (пример наполнения банка идей). */
export function seedIdeas(): Idea[] {
  return [
    {
      id: 'i1',
      title: 'Как спека до кода ускорила проект в 3 раза',
      hook: 'Не «вайбкодинг». Сначала спецификация и архитектура, потом генерация. Вот что реально изменилось.',
      cluster: 'spec',
      formula: 'arch',
      source: 'Кейс из практики',
      channel: 'LinkedIn',
      status: 'draft',
      date: '',
      refPostId: '',
      predicted: 0,
      actual: null,
    },
    {
      id: 'i2',
      title: 'Дневник отказов: что дают провалы, если считать их данными',
      hook: 'Разобрал серию отказов как данные — и нашёл повторяющуюся систему. Делюсь выводами.',
      cluster: 'jobs',
      formula: 'fail',
      source: 'Личный опыт',
      channel: 'Telegram',
      status: 'draft',
      date: '',
      refPostId: '',
      predicted: 0,
      actual: null,
    },
    {
      id: 'i3',
      title: 'AI для бизнеса: 3 сценария внедрения, которые дали результат',
      hook: 'Внедрил AI-процессы в реальную команду. Показываю сценарии и что именно сработало.',
      cluster: 'enable',
      formula: 'meta',
      source: 'Кейс внедрения',
      channel: 'LinkedIn',
      status: 'draft',
      date: '',
      refPostId: '',
      predicted: 0,
      actual: null,
    },
  ];
}
