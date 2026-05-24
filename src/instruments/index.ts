import { Instrument, ResponseScale } from './types';
import { sp2Strategy } from '../infrastructure/utils/scoring/strategies/sp2Strategy';

const SP2_SCALE: ResponseScale = {
  id: 'sp2-likert-5',
  options: [
    { value: 'quase sempre',    label: 'Quase Sempre',     numeric: 5 },
    { value: 'frequentemente',  label: 'Frequentemente',   numeric: 4 },
    { value: 'metade do tempo', label: 'Metade do Tempo',  numeric: 3 },
    { value: 'ocasionalmente',  label: 'Ocasionalmente',   numeric: 2 },
    { value: 'quase nunca',     label: 'Quase Nunca',      numeric: 1 },
    { value: 'não se aplica',   label: 'Não Se Aplica',    numeric: 0 },
  ],
};

// SP-2 instrument definition. scoringStrategy is now a real implementation via
// sp2Strategy; the legacy flag keeps AssessmentService on its existing code path
// so no callers break during the transition.
// Section keys must match those expected by assessmentValidation.ts and AssessmentService.
const sp2Stub: Instrument = {
  id: 'crianca-3-14',
  name: 'Perfil Sensorial 2 — Criança (3–14 anos)',
  shortName: 'Perfil Sensorial 2',
  ageRange: '3-14',
  scale: SP2_SCALE,
  legacy: true,
  hasQuadrants: true,
  sections: [
    { key: 'auditoryProcessing',        label: 'Processamento Auditivo',         itemIds: [] },
    { key: 'visualProcessing',          label: 'Processamento Visual',           itemIds: [] },
    { key: 'tactileProcessing',         label: 'Processamento Tátil',            itemIds: [] },
    { key: 'movementProcessing',        label: 'Processamento de Movimento',     itemIds: [] },
    { key: 'bodyPositionProcessing',    label: 'Processamento Posição Corporal', itemIds: [] },
    { key: 'oralSensitivityProcessing', label: 'Processamento Oral',             itemIds: [] },
    { key: 'behavioralResponses',       label: 'Respostas de Conduta',           itemIds: [] },
    { key: 'socialEmotionalResponses',  label: 'Respostas Socioemocionais',      itemIds: [] },
    { key: 'attentionResponses',        label: 'Respostas de Atenção',           itemIds: [] },
  ],
  scoringStrategy: sp2Strategy,
};

// Also register crianca-pequena (frontend-only so far; same scale and legacy path).
const sp2SmallStub: Instrument = {
  ...sp2Stub,
  id: 'crianca-pequena',
  name: 'Perfil Sensorial 2 — Criança Pequena',
  shortName: 'Perfil Sensorial 2 Pequena',
  ageRange: '0-2',
};

const registry: Record<string, Instrument> = {
  'crianca-3-14': sp2Stub,
  'crianca-pequena': sp2SmallStub,
};

export function getInstrument(id: string): Instrument | undefined {
  return registry[id];
}

export function registerInstrument(instrument: Instrument): void {
  registry[instrument.id] = instrument;
}

export function listInstruments(): Instrument[] {
  return Object.values(registry);
}

export const DEFAULT_INSTRUMENT_ID = 'crianca-3-14';

// Side-effect imports: each file calls registerInstrument() on load
import './mchat-r';
import './atec';
import './mchat-rf-followup';
