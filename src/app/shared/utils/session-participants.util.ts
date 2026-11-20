import {
  IndividualParticipantMode,
  SessionParticipantDraft,
} from '../../core/services/sessions.service';

export interface ApiParticipantPayload {
  clientId?: number;
  customName?: string;
}

export interface IndividualParticipantsState {
  participants: SessionParticipantDraft[];
  anonymousCount: number;
  mode: IndividualParticipantMode;
}

export function getTotalParticipantsCount(
  participants?: ReadonlyArray<unknown>,
  anonymousCount?: number,
): number {
  return (participants?.length ?? 0) + Math.max(0, anonymousCount ?? 0);
}

export function sanitizeParticipantsForApi(
  participants: SessionParticipantDraft[],
): ApiParticipantPayload[] {
  const seenClientIds = new Set<number>();
  const result: ApiParticipantPayload[] = [];

  for (const participant of participants) {
    if (typeof participant.clientId === 'number' && participant.clientId > 0) {
      if (seenClientIds.has(participant.clientId)) {
        continue;
      }
      seenClientIds.add(participant.clientId);
      result.push({ clientId: participant.clientId });
      continue;
    }

    const trimmed = participant.customName?.trim();
    if (trimmed) {
      result.push({ customName: trimmed });
    }
  }

  return result;
}

export function resolveIndividualMode(
  participants: SessionParticipantDraft[],
): IndividualParticipantMode {
  if (participants.some((p) => typeof p.clientId === 'number' && p.clientId > 0)) {
    return 'CLIENT';
  }
  if (participants.some((p) => !p.clientId && Boolean(p.customName?.trim()))) {
    return 'CUSTOM';
  }
  return 'ANONYMOUS';
}

export function normalizeParticipantsForIndividual(
  participants: SessionParticipantDraft[],
): IndividualParticipantsState {
  const firstClient = participants.find((p) => typeof p.clientId === 'number' && p.clientId > 0);
  if (firstClient) {
    return {
      participants: [firstClient],
      anonymousCount: 0,
      mode: 'CLIENT',
    };
  }

  const firstCustom = participants.find((p) => !p.clientId && Boolean(p.customName?.trim()));
  if (firstCustom) {
    return {
      participants: [firstCustom],
      anonymousCount: 0,
      mode: 'CUSTOM',
    };
  }

  return {
    participants: [],
    anonymousCount: 1,
    mode: 'ANONYMOUS',
  };
}

export function validateSessionParticipants(
  sessionType: 'INDIVIDUAL' | 'GROUP',
  individualMode: IndividualParticipantMode,
  participants: SessionParticipantDraft[],
  anonymousCount: number,
): string | null {
  if (anonymousCount < 0) {
    return 'Кількість учасників без імені не може бути відʼємною';
  }

  if (sessionType !== 'INDIVIDUAL') {
    return null;
  }

  const sanitized = sanitizeParticipantsForApi(participants);
  if (individualMode === 'CLIENT' && !sanitized.some((p) => typeof p.clientId === 'number')) {
    return 'Оберіть клієнта або перемкніть режим на «Без імені (1)»';
  }

  if (individualMode === 'CUSTOM' && !sanitized.some((p) => Boolean(p.customName))) {
    return 'Впишіть імʼя учасника або перемкніть режим на «Без імені (1)»';
  }

  const total = sanitized.length + anonymousCount;
  if (total > 1) {
    return 'Для індивідуального тренування може бути не більше 1 учасника';
  }

  return null;
}
