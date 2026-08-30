import { createDailyReportSchema, listDailyReportsSchema, updateDailyReportSchema } from '../dailyReportValidation';

const CHILD = '11111111-1111-1111-1111-111111111111';

describe('createDailyReportSchema', () => {
  test('accepts what a browser MediaRecorder actually reports', () => {
    // Chrome/Firefox
    expect(createDailyReportSchema.parse({ childId: CHILD, reportDate: '2026-08-20', mimeType: 'audio/webm;codecs=opus' }).mimeType)
      .toBe('audio/webm');
    // Safari
    expect(createDailyReportSchema.parse({ childId: CHILD, reportDate: '2026-08-20', mimeType: 'audio/mp4' }).mimeType)
      .toBe('audio/mp4');
  });

  test('rejects non-audio uploads', () => {
    expect(() =>
      createDailyReportSchema.parse({ childId: CHILD, reportDate: '2026-08-20', mimeType: 'video/mp4' }),
    ).toThrow();
    expect(() =>
      createDailyReportSchema.parse({ childId: CHILD, reportDate: '2026-08-20', mimeType: 'application/pdf' }),
    ).toThrow();
  });

  test('rejects a timestamp where a plain date is expected', () => {
    expect(() =>
      createDailyReportSchema.parse({ childId: CHILD, reportDate: '2026-08-20T10:00:00Z', mimeType: 'audio/webm' }),
    ).toThrow();
  });

  test('rejects a childId that is not a uuid', () => {
    expect(() =>
      createDailyReportSchema.parse({ childId: 'nope', reportDate: '2026-08-20', mimeType: 'audio/webm' }),
    ).toThrow();
  });
});

describe('listDailyReportsSchema', () => {
  test('defaults and caps the limit', () => {
    expect(listDailyReportsSchema.parse({ childId: CHILD }).limit).toBe(30);
    expect(() => listDailyReportsSchema.parse({ childId: CHILD, limit: '500' })).toThrow();
  });
});

describe('updateDailyReportSchema', () => {
  test('accepts a corrected transcript', () => {
    expect(updateDailyReportSchema.parse({ transcript: 'Texto corrigido.' }).transcript).toBe('Texto corrigido.');
  });

  test('trims surrounding whitespace', () => {
    expect(updateDailyReportSchema.parse({ transcript: '  Texto corrigido.  ' }).transcript).toBe('Texto corrigido.');
  });

  test('rejects an empty transcript', () => {
    expect(() => updateDailyReportSchema.parse({ transcript: '' })).toThrow();
    expect(() => updateDailyReportSchema.parse({ transcript: '   ' })).toThrow();
  });

  test('rejects a transcript over the length cap', () => {
    expect(() => updateDailyReportSchema.parse({ transcript: 'a'.repeat(20001) })).toThrow();
  });
});
