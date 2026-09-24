import { describe, expect, it } from '@jest/globals';
import { interpolate } from '@/i18n/LanguageProvider';
import { strings, type StringKey } from '@/i18n/strings';
import { defaultForm, prizePoolPaise, stepForPath, toPaise, toPayload, validateStep } from '../formModel';

const t = (key: StringKey, params?: Record<string, string | number>) => interpolate(strings.en[key], params);
const NOW = new Date('2026-08-01T10:15:00Z');

describe('competition form model', () => {
  it('converts rupees to paise safely', () => {
    expect(toPaise('99')).toBe(9900);
    expect(toPaise('99.5')).toBe(9950);
    expect(toPaise(' 0 ')).toBe(0);
    expect(toPaise('1e3')).toBeNaN();
    expect(toPaise('-5')).toBeNaN();
  });

  it('builds the API payload: paise, positions, optional Hindi dropped when empty', () => {
    const s = defaultForm(NOW);
    s.title = { en: ' Kathak Cup ', hi: '' };
    s.tags = [{ en: 'Dance', hi: 'नृत्य' }, { en: '', hi: '' }];
    s.judge = { ...s.judge, name: 'Manju', title: { en: 'Kathak Dancer', hi: '' }, experienceYears: '12', avatarPath: '/uploads/images/a.jpg' };
    s.about = { en: 'About', hi: '' };
    const p = toPayload(s);
    expect(p.title).toEqual({ en: 'Kathak Cup' });
    expect(p.tags).toEqual([{ en: 'Dance', hi: 'नृत्य' }]);
    expect(p.entryFee).toBe(9900);
    expect(p.rewards).toEqual([
      { position: 1, amount: 50000 },
      { position: 2, amount: 30000 },
      { position: 3, amount: 20000 },
    ]);
    expect(p.judge).toEqual({ name: 'Manju', title: { en: 'Kathak Dancer' }, experienceYears: 12, avatarUrl: '/uploads/images/a.jpg' });
    expect(prizePoolPaise(s)).toBe(100000);
  });

  it('default schedule is valid and each step reports its own problems', () => {
    const s = defaultForm(NOW);
    expect(validateStep('schedule', s, t)).toEqual({});
    s.timeline.resultAt = new Date(s.timeline.submissionEndsAt.getTime() - 1);
    expect(Object.keys(validateStep('schedule', s, t))).toEqual(['timeline.resultAt']);

    expect(validateStep('basics', s, t)).toEqual({ title: 'Required' });
    s.seatsTotal = '3';
    expect(validateStep('prizes', s, t, 5)).toEqual({ seatsTotal: '5 spots already taken' });
    s.judgingParameters = [{ title: { en: 'Pitch', hi: '' }, weight: '60' }];
    s.about = { en: 'x', hi: '' };
    expect(validateStep('content', s, t)).toHaveProperty(['content.judgingParameters']);
  });

  it('maps server error paths to form steps', () => {
    expect(stepForPath('timeline.resultAt')).toBe('schedule');
    expect(stepForPath('rewards')).toBe('prizes');
    expect(stepForPath('judge.title.en')).toBe('judge');
    expect(stepForPath('content.about.en')).toBe('content');
    expect(stepForPath('title.en')).toBe('basics');
  });
});
