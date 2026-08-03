import { describe, expect, it } from 'vitest';
import { buildAltText, CARD_W, CARD_H } from './shareCard';
import { enrich } from './enrich';

describe('Б8: alt-текст карточки', () => {
  it('содержит автора, кластер, приёмы и метрики; честен про неизвестные метрики', () => {
    const p = enrich({
      author: 'Анна К.',
      headline: '10 000 подписчиков',
      text: 'Как spec-driven разработка спасла проект? Цифры внутри.',
      reactions: 120,
      comments: 45,
      query: 'tavily:claude code spec driven',
    });
    const alt = buildAltText(p, 'Spec-driven / Claude Code');
    expect(alt).toContain('Анна К.');
    expect(alt).toContain('Spec-driven / Claude Code');
    expect(alt).toContain(p.tags.hook_type);
    expect(alt).toContain('45');

    const noMetrics = enrich({ author: 'Б.', text: 'Пост без метрик вообще', reactions: 0, comments: 0 });
    expect(buildAltText(noMetrics, 'Другое')).toContain('метрики неизвестны');
  });

  it('has_metrics=true, но reactions=0 → "реакции неизвестны"', () => {
    const p = enrich({ author: 'А', text: 'Текст поста', reactions: 0, comments: 5 });
    const alt = buildAltText(p, 'X');
    expect(alt).toContain('реакции неизвестны');
    expect(alt).toContain('5');
  });

  it('has_metrics=true, comments=0 → "комментарии неизвестны"', () => {
    const p = enrich({ author: 'А', text: 'Текст поста', reactions: 10, comments: 0 });
    const alt = buildAltText(p, 'Y');
    expect(alt).toContain('10');
    expect(alt).toContain('комментарии неизвестны');
  });

  it('форматирование больших чисел', () => {
    const p = enrich({ author: 'А', text: 'Текст', reactions: 1500, comments: 200 });
    const alt = buildAltText(p, 'Z');
    expect(alt).toContain('1');
    expect(alt).toContain('500');
    expect(alt).toContain('200');
  });

  it('содержит название продукта', () => {
    const p = enrich({ author: 'А', text: 'Текст', reactions: 1, comments: 1 });
    const alt = buildAltText(p, 'Кластер');
    expect(alt).toContain('Сгенерировано в');
  });
});

describe('shareCard: константы', () => {
  it('CARD_W и CARD_H — стандартные размеры OG-карточки', () => {
    expect(CARD_W).toBe(1200);
    expect(CARD_H).toBe(630);
  });
});
