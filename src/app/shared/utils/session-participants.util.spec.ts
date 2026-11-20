import {
  getTotalParticipantsCount,
  normalizeParticipantsForIndividual,
  resolveIndividualMode,
  sanitizeParticipantsForApi,
  validateSessionParticipants,
} from './session-participants.util';

describe('session-participants.util', () => {
  it('computes total participants as named + anonymous count', () => {
    expect(getTotalParticipantsCount([{ clientId: 2 }, { customName: 'Аня' }, { customName: 'Лера' }], 3)).toBe(6);
    expect(getTotalParticipantsCount([], 0)).toBe(0);
  });

  it('sanitizes participants by trimming names, skipping empty entries, and deduplicating clientIds', () => {
    const result = sanitizeParticipantsForApi([
      { clientId: 2 },
      { clientId: 2 },
      { customName: '  Аня  ' },
      { customName: '   ' },
      { customName: 'Лера' },
    ]);

    expect(result).toEqual([{ clientId: 2 }, { customName: 'Аня' }, { customName: 'Лера' }]);
  });

  it('normalizes GROUP participants down to 1 when switching to INDIVIDUAL', () => {
    const withClient = normalizeParticipantsForIndividual([
      { customName: 'Аня' },
      { clientId: 5 },
    ]);
    expect(withClient).toEqual({
      participants: [{ clientId: 5 }],
      anonymousCount: 0,
      mode: 'CLIENT',
    });

    const empty = normalizeParticipantsForIndividual([]);
    expect(empty).toEqual({
      participants: [],
      anonymousCount: 1,
      mode: 'ANONYMOUS',
    });
  });

  it('resolves initial individual mode accurately', () => {
    expect(resolveIndividualMode([{ clientId: 4 }])).toBe('CLIENT');
    expect(resolveIndividualMode([{ customName: 'Лера' }])).toBe('CUSTOM');
    expect(resolveIndividualMode([])).toBe('ANONYMOUS');
  });

  it('validates INDIVIDUAL session limit and required selection per mode', () => {
    expect(validateSessionParticipants('INDIVIDUAL', 'ANONYMOUS', [], 1)).toBeNull();
    expect(validateSessionParticipants('INDIVIDUAL', 'CLIENT', [], 0)).not.toBeNull();
    expect(validateSessionParticipants('INDIVIDUAL', 'CUSTOM', [{ customName: '  ' }], 0)).not.toBeNull();
    expect(validateSessionParticipants('INDIVIDUAL', 'CLIENT', [{ clientId: 1 }], 1)).not.toBeNull();
    expect(
      validateSessionParticipants(
        'GROUP',
        'ANONYMOUS',
        [{ clientId: 2 }, { customName: 'Аня' }, { customName: 'Лера' }],
        3,
      ),
    ).toBeNull();
  });
});
