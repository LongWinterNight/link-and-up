import { describe, expect, it } from 'vitest';
import { buildAltText } from './shareCard';
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
});
