import { Instrument, ResponseScale } from '../types';
import { registerInstrument } from '../index';
import { mchatRStrategy } from './scoring';

const MCHAT_R_SCALE: ResponseScale = {
  id: 'yes-no',
  options: [
    { value: 'sim', label: 'Sim', numeric: 1 },
    { value: 'nao', label: 'Não', numeric: 0 },
  ],
};

const ITEM_IDS = Array.from({ length: 20 }, (_, i) => 3001 + i);

const mchatR: Instrument = {
  id: 'mchat-r',
  name: 'M-CHAT-R — Modificado para Triagem de Autismo em Toddlers (Revisado)',
  shortName: 'M-CHAT-R',
  ageRange: '16-30 meses',
  scale: MCHAT_R_SCALE,
  hasQuadrants: false,
  allowsLinkedFollowup: true,
  sections: [
    {
      key: 'triagem',
      label: 'Triagem M-CHAT-R',
      itemIds: ITEM_IDS,
    },
  ],
  scoringStrategy: mchatRStrategy,
};

registerInstrument(mchatR);
