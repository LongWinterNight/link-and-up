import { describe, expect, it, vi, beforeEach } from 'vitest';
import { download } from './download';

describe('download', () => {
  const clicked: { href: string; download: string }[] = [];
  const revoked: string[] = [];

  beforeEach(() => {
    clicked.length = 0;
    revoked.length = 0;
    // jsdom не реализует createObjectURL/revokeObjectURL — определяем заглушки
    if (!URL.createObjectURL) {
      URL.createObjectURL = () => 'blob:http://localhost/fake';
    }
    if (!URL.revokeObjectURL) {
      URL.revokeObjectURL = () => {};
    }
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:http://localhost/fake');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation((u: string) => revoked.push(u));
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'a') {
        const a = {
          href: '',
          download: '',
          click: () => clicked.push({ href: a.href, download: a.download }),
        } as unknown as HTMLAnchorElement;
        return a;
      }
      return document.createElement(tag);
    });
  });

  it('создаёт ссылку с правильным именем и вызывает click', () => {
    download('report.json', '{"a":1}', 'application/json');
    expect(clicked).toHaveLength(1);
    expect(clicked[0].download).toBe('report.json');
    expect(clicked[0].href).toContain('blob:');
  });

  it('дефолтный MIME = application/json', () => {
    download('f.txt', 'hello');
    expect(clicked).toHaveLength(1);
  });

  it('ревокает URL через 1 секунду', () => {
    vi.useFakeTimers();
    download('f.csv', 'a,b', 'text/csv');
    expect(revoked).toHaveLength(0);
    vi.advanceTimersByTime(1000);
    expect(revoked).toHaveLength(1);
    vi.useRealTimers();
  });
});
