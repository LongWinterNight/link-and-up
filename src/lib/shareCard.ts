import type { Post } from '@/types';
import { nf } from './stats';
import { PRODUCT_NAME } from './constants';

/**
 * Б8 (P-4): шаримая карточка разбора поста. Резолюции совета: генерация СТРОГО локальная
 * (canvas, ничего не уходит с устройства), водяной знак обязателен (защита от подделки и
 * контур роста), явный consent перед генерацией, автопостинга нет. Alt-текст — автогенерация.
 */

export const CARD_W = 1200;
export const CARD_H = 630;
const WATERMARK = PRODUCT_NAME + ' · link-and-up.vercel.app';

/** Автогенерируемый alt-текст карточки (Accessibility: изображение недоступно скринридеру). */
export function buildAltText(post: Post, clusterLabel: string): string {
  const metrics = post.has_metrics
    ? nf(post.reactions) + ' реакций, ' + nf(post.comments) + ' комментариев'
    : 'метрики неизвестны';
  return (
    'Карточка разбора поста LinkedIn. Автор: ' +
    post.author +
    '. Кластер: ' +
    clusterLabel +
    '. Приёмы: ' +
    post.tags.hook_type +
    ', ' +
    post.tags.structure +
    ', ' +
    post.tags.emotion +
    '. Вовлечение: ' +
    metrics +
    '. Сгенерировано в ' +
    PRODUCT_NAME +
    '.'
  );
}

/** Перенос строки по ширине (canvas не умеет multiline). */
function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
  const words = text.replace(/\s+/g, ' ').trim().split(' ');
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const probe = cur ? cur + ' ' + w : w;
    if (ctx.measureText(probe).width <= maxWidth) {
      cur = probe;
    } else {
      if (cur) lines.push(cur);
      cur = w;
      if (lines.length === maxLines - 1) break;
    }
  }
  if (cur && lines.length < maxLines) lines.push(cur);
  if (lines.length === maxLines && words.join(' ').length > lines.join(' ').length) {
    lines[maxLines - 1] = lines[maxLines - 1].replace(/\s*\S*$/, '') + '…';
  }
  return lines;
}

function pill(ctx: CanvasRenderingContext2D, x: number, y: number, label: string): number {
  ctx.font = '500 22px system-ui, sans-serif';
  const w = ctx.measureText(label).width + 36;
  ctx.fillStyle = 'rgba(122, 162, 255, 0.14)';
  ctx.strokeStyle = 'rgba(122, 162, 255, 0.5)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(x, y, w, 44, 22);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#9db8ff';
  ctx.fillText(label, x + 18, y + 30);
  return w;
}

/** Рисует карточку на canvas и возвращает PNG-blob. Только локально; без сети. */
export async function drawShareCard(post: Post, clusterLabel: string): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas недоступен в этом браузере');

  // фон
  const grad = ctx.createLinearGradient(0, 0, CARD_W, CARD_H);
  grad.addColorStop(0, '#101623');
  grad.addColorStop(1, '#1a2233');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, CARD_W, CARD_H);
  ctx.strokeStyle = 'rgba(122, 162, 255, 0.25)';
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, CARD_W - 2, CARD_H - 2);

  // шапка: разбор поста
  ctx.fillStyle = '#8b93a7';
  ctx.font = '600 26px system-ui, sans-serif';
  ctx.fillText('РАЗБОР ПОСТА', 64, 84);

  // автор + кластер
  ctx.fillStyle = '#e8ecf4';
  ctx.font = '700 44px system-ui, sans-serif';
  ctx.fillText(post.author.slice(0, 40), 64, 148);
  ctx.fillStyle = '#8b93a7';
  ctx.font = '400 26px system-ui, sans-serif';
  ctx.fillText(clusterLabel.slice(0, 60), 64, 190);

  // текст поста (цитата)
  ctx.fillStyle = '#c3c9d6';
  ctx.font = '400 30px system-ui, sans-serif';
  const body = post.text.replace(/\s*Формат\s*:.*/is, '');
  const lines = wrapText(ctx, body, CARD_W - 128, 4);
  lines.forEach((l, i) => ctx.fillText(l, 64, 254 + i * 44));

  // приёмы
  let px = 64;
  const py = 436;
  for (const label of [post.tags.hook_type, post.tags.structure, post.tags.emotion]) {
    px += pill(ctx, px, py, label) + 14;
    if (px > CARD_W - 240) break;
  }

  // метрики
  ctx.fillStyle = '#e8ecf4';
  ctx.font = '700 40px system-ui, sans-serif';
  const metrics = post.has_metrics ? '♥ ' + nf(post.reactions) + '   💬 ' + nf(post.comments) : 'метрики неизвестны';
  ctx.fillText(metrics, 64, 556);
  if (post.rate != null) {
    ctx.fillStyle = '#8b93a7';
    ctx.font = '400 28px system-ui, sans-serif';
    ctx.fillText('ER ' + (post.rate * 100).toFixed(2) + '%', 64 + ctx.measureText(metrics).width + 120, 556);
  }

  // водяной знак — обязателен (Б8-резолюция)
  ctx.fillStyle = 'rgba(157, 184, 255, 0.75)';
  ctx.font = '600 24px system-ui, sans-serif';
  const wm = WATERMARK;
  ctx.fillText(wm, CARD_W - ctx.measureText(wm).width - 48, CARD_H - 36);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Не удалось сформировать PNG'))), 'image/png');
  });
}
