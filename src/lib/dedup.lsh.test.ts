import { describe, expect, it } from 'vitest';
import { analyzeIngest, diceSim, minhashSig, normText, sigOverlap } from './dedup';

/** SCALE-10: LSH-префильтр не должен терять настоящие near-dup (recall) и обязан резать непохожее. */
describe('SCALE-10: minhash-префильтр near-dup', () => {
  it('идентичные строки → полное совпадение сигнатур; непохожие → низкое', () => {
    const a = normText(
      'Спека до кода — и Claude Code перестал фантазировать. Вот мои пять выводов после месяца работы.',
    );
    const b = normText(
      'Спека до кода — и Claude Code перестал фантазировать! Вот мои пять выводов после месяца работы…',
    );
    const c = normText('Сегодня про найм: как собеседовать джунов и не выгореть самому. Чеклист внутри поста.');
    expect(sigOverlap(minhashSig(a), minhashSig(a))).toBe(8);
    // почти одинаковые тексты (Dice высокий) проходят порог 4/8
    expect(diceSim(a, b)).toBeGreaterThan(0.82);
    expect(sigOverlap(minhashSig(a), minhashSig(b))).toBeGreaterThanOrEqual(4);
    // тематически разные — отсекаются префильтром
    expect(sigOverlap(minhashSig(a), minhashSig(c))).toBeLessThan(4);
  });

  it('интеграция: near-dup в одноавторном бакете по-прежнему ловится', () => {
    const existing = analyzeIngest(
      [],
      [
        {
          author: 'Один Автор',
          text: 'Разбираю провал запуска: три ошибки, которые стоили нам месяц работы и веру команды. Выводы в конце.',
          reactions: 5,
          comments: 2,
        },
      ],
    );
    expect(existing.added).toBe(1);
    const rep = analyzeIngest(
      [],
      [
        {
          author: 'Один Автор',
          text: 'Разбираю провал запуска: три ошибки, которые стоили нам месяц работы и веру команды. Выводы в конце.',
          reactions: 5,
          comments: 2,
        },
        {
          author: 'Один Автор',
          text: 'Разбираю провал нашего запуска — три ошибки, которые стоили нам месяц работы и веру команды. Выводы в конце.',
          reactions: 7,
          comments: 3,
        },
        {
          author: 'Один Автор',
          text: 'Совсем другой пост про то, как мы выбирали стек для нового продукта и почему остановились на скучном.',
          reactions: 1,
          comments: 0,
        },
      ],
    );
    expect(rep.added).toBe(2); // оригинал + другой пост
    expect(rep.nearDupes).toBe(1); // вариация с пунктуацией отсеяна
  });
});
