import { describe, expect, it, vi, beforeEach } from 'vitest';
import { buildAltText, drawShareCard, CARD_W, CARD_H } from './shareCard';
import { enrich } from './enrich';
import type { ShareCardLabels } from './shareCard';

// --- mock canvas для drawShareCard ---
const mockCalls: string[] = [];
let returnNullContext = false;

function createMockCtx() {
  const mockGradient = {
    addColorStop: (...args: unknown[]) => {
      mockCalls.push('addColorStop(' + args.map((a) => String(a).slice(0, 30)).join(',') + ')');
    },
  };
  const handler: ProxyHandler<CanvasRenderingContext2D> = {
    get(_, prop) {
      if (prop === 'measureText') return (text: string) => ({ width: text.length * 12 });
      if (prop === 'createLinearGradient')
        return (...args: unknown[]) => {
          mockCalls.push('createLinearGradient(' + args.join(',') + ')');
          return mockGradient;
        };
      if (typeof prop === 'string' && prop !== 'canvas') {
        return (...args: unknown[]) => {
          mockCalls.push(prop + '(' + args.map((a) => String(a).slice(0, 30)).join(',') + ')');
          return undefined;
        };
      }
      return undefined;
    },
    set() {
      return true;
    },
  };
  return new Proxy({} as CanvasRenderingContext2D, handler);
}

const originalCreateElement = document.createElement.bind(document);

beforeEach(() => {
  mockCalls.length = 0;
  returnNullContext = false;
});

vi.stubGlobal('document', {
  ...document,
  createElement: (tag: string) => {
    if (tag === 'canvas') {
      return {
        width: 0,
        height: 0,
        getContext: (type: string) => {
          if (returnNullContext) return null;
          if (type === '2d') return createMockCtx();
          return null;
        },
        toBlob: (cb: (b: Blob | null) => void, mime: string) => {
          if (mime === 'image/png') cb(new Blob(['png'], { type: 'image/png' }));
          else cb(null);
        },
      };
    }
    return originalCreateElement(tag);
  },
});

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

  it('buildAltText с labels — английские строки', () => {
    const enLabels: ShareCardLabels = {
      altPrefix: 'LinkedIn post analysis card. Author: ',
      altCluster: '. Cluster: ',
      altTechniques: '. Techniques: ',
      altEngagement: '. Engagement: ',
      altReactions: ' reactions',
      altReactionsUnknown: 'reactions unknown',
      altComments: ' comments',
      altCommentsUnknown: 'comments unknown',
      altMetricsUnknown: 'metrics unknown',
      altGenerated: '. Generated in ',
      heading: 'POST ANALYSIS',
      metricsUnknown: 'metrics unknown',
      canvasError: 'Canvas unavailable in this browser',
      pngError: 'Failed to generate PNG',
    };
    const p = enrich({ author: 'John', text: 'Test post', reactions: 10, comments: 5 });
    const alt = buildAltText(p, 'AI Agents', enLabels);
    expect(alt).toContain('LinkedIn post analysis card. Author: ');
    expect(alt).toContain('. Cluster: ');
    expect(alt).toContain('10 reactions');
    expect(alt).toContain('5 comments');
  });

  it('buildAltText с labels — метрики неизвестны', () => {
    const enLabels: ShareCardLabels = {
      altPrefix: 'Card. Author: ',
      altCluster: '. Cluster: ',
      altTechniques: '. Techniques: ',
      altEngagement: '. Engagement: ',
      altReactions: ' reactions',
      altReactionsUnknown: 'reactions unknown',
      altComments: ' comments',
      altCommentsUnknown: 'comments unknown',
      altMetricsUnknown: 'metrics unknown',
      altGenerated: '. Generated in ',
      heading: 'POST ANALYSIS',
      metricsUnknown: 'metrics unknown',
      canvasError: 'Canvas unavailable',
      pngError: 'PNG failed',
    };
    const p = enrich({ author: 'X', text: 'No metrics', reactions: 0, comments: 0 });
    const alt = buildAltText(p, 'Other', enLabels);
    expect(alt).toContain('metrics unknown');
  });
});

describe('shareCard: константы', () => {
  it('CARD_W и CARD_H — стандартные размеры OG-карточки', () => {
    expect(CARD_W).toBe(1200);
    expect(CARD_H).toBe(630);
  });
});

describe('drawShareCard: mock-canvas', () => {
  it('рисует карточку и возвращает PNG blob', async () => {
    const p = enrich({ author: 'Тест Автор', text: 'Текст поста для карточки', reactions: 50, comments: 10 });
    const blob = await drawShareCard(p, 'Spec-driven');
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe('image/png');
    // проверяем что canvas-вызовы были
    expect(mockCalls.some((c) => c.startsWith('fillRect'))).toBe(true);
    expect(mockCalls.some((c) => c.startsWith('fillText'))).toBe(true);
    expect(mockCalls.some((c) => c.startsWith('createLinearGradient'))).toBe(true);
    expect(mockCalls.some((c) => c.startsWith('strokeRect'))).toBe(true);
  });

  it('отрисовывает автора, кластер, заголовок', async () => {
    const p = enrich({ author: 'Мария', text: 'Пост про AI', reactions: 30, comments: 5 });
    await drawShareCard(p, 'AI-агенты');
    const fillTextCalls = mockCalls.filter((c) => c.startsWith('fillText'));
    // проверяем что fillText вызывался (автор, кластер, заголовок, метрики, водяной знак)
    expect(fillTextCalls.length).toBeGreaterThanOrEqual(5);
  });

  it('отрисовывает метрики при has_metrics=true', async () => {
    const p = enrich({ author: 'А', text: 'Текст', reactions: 100, comments: 20 });
    await drawShareCard(p, 'Кластер');
    const metricsCall = mockCalls.find((c) => c.includes('♥') || c.includes('💬'));
    expect(metricsCall).toBeTruthy();
  });

  it('отрисовывает "метрики неизвестны" при has_metrics=false', async () => {
    const p = enrich({ author: 'А', text: 'Текст', reactions: 0, comments: 0 });
    await drawShareCard(p, 'Кластер');
    const unknownCall = mockCalls.find((c) => c.includes('метрики неизвестны'));
    expect(unknownCall).toBeTruthy();
  });

  it('выбрасывает ошибку, если canvas недоступен', async () => {
    returnNullContext = true;
    const p = enrich({ author: 'А', text: 'Текст', reactions: 1, comments: 1 });
    await expect(drawShareCard(p, 'X')).rejects.toThrow('Canvas недоступен');
  });

  it('выбрасывает ошибку с labels, если canvas недоступен', async () => {
    returnNullContext = true;
    const enLabels: ShareCardLabels = {
      altPrefix: '',
      altCluster: '',
      altTechniques: '',
      altEngagement: '',
      altReactions: '',
      altReactionsUnknown: '',
      altComments: '',
      altCommentsUnknown: '',
      altMetricsUnknown: '',
      altGenerated: '',
      heading: '',
      metricsUnknown: '',
      canvasError: 'Canvas unavailable in this browser',
      pngError: 'PNG failed',
    };
    const p = enrich({ author: 'A', text: 'Text', reactions: 1, comments: 1 });
    await expect(drawShareCard(p, 'X', enLabels)).rejects.toThrow('Canvas unavailable in this browser');
  });

  it('рисует pills для приёмов', async () => {
    const p = enrich({ author: 'А', text: 'Текст про AI и данные', reactions: 10, comments: 5 });
    await drawShareCard(p, 'Кластер');
    // pill рисует roundRect + fill + stroke + fillText
    expect(mockCalls.some((c) => c.startsWith('roundRect'))).toBe(true);
  });

  it('с labels — английский заголовок "POST ANALYSIS"', async () => {
    const enLabels: ShareCardLabels = {
      altPrefix: '',
      altCluster: '',
      altTechniques: '',
      altEngagement: '',
      altReactions: '',
      altReactionsUnknown: '',
      altComments: '',
      altCommentsUnknown: '',
      altMetricsUnknown: '',
      altGenerated: '',
      heading: 'POST ANALYSIS',
      metricsUnknown: 'metrics unknown',
      canvasError: 'Canvas unavailable',
      pngError: 'PNG failed',
    };
    const p = enrich({ author: 'A', text: 'English text', reactions: 10, comments: 5 });
    await drawShareCard(p, 'AI Agents', enLabels);
    const headingCall = mockCalls.find((c) => c.includes('POST ANALYSIS'));
    expect(headingCall).toBeTruthy();
  });

  it('с labels — "metrics unknown" для поста без метрик', async () => {
    const enLabels: ShareCardLabels = {
      altPrefix: '',
      altCluster: '',
      altTechniques: '',
      altEngagement: '',
      altReactions: '',
      altReactionsUnknown: '',
      altComments: '',
      altCommentsUnknown: '',
      altMetricsUnknown: '',
      altGenerated: '',
      heading: 'POST ANALYSIS',
      metricsUnknown: 'metrics unknown',
      canvasError: 'Canvas unavailable',
      pngError: 'PNG failed',
    };
    const p = enrich({ author: 'A', text: 'No metrics text', reactions: 0, comments: 0 });
    await drawShareCard(p, 'Other', enLabels);
    const unknownCall = mockCalls.find((c) => c.includes('metrics unknown'));
    expect(unknownCall).toBeTruthy();
  });
});
