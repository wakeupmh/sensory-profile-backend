import { registerInstrument } from '../index';
import { Instrument, InstrumentSection, ResponseScale } from '../types';
import { mchatRFFollowupStrategy } from './scoring';

const FOLLOWUP_SCALE: ResponseScale = {
  id: 'followup-pass-fail',
  options: [
    { value: 'passou', label: 'Passou', numeric: 0 }, // item reclassified pass = 0 fails
    { value: 'falhou', label: 'Falhou', numeric: 1 }, // item still fails = 1
  ],
};

function dynamicSections(parent: { scores_json: Record<string, unknown> }): InstrumentSection[] {
  const failedItemIds = (parent.scores_json.failedItemIds as number[]) ?? [];
  return failedItemIds.map((screenItemId) => {
    // Offset: screen items are 3001-3020, probe items are 4001-4020
    const probeItemId = screenItemId - 3000 + 4000;
    const screenItemNumber = screenItemId - 3000;
    return {
      key: `followup_item_${screenItemNumber}`,
      label: `Item ${screenItemNumber}`,
      itemIds: [probeItemId],
    };
  });
}

const mchatRFFollowup: Instrument = {
  id: 'mchat-rf-followup',
  name: 'M-CHAT-R/F — Entrevista de Acompanhamento',
  shortName: 'M-CHAT-R/F',
  ageRange: '16-30 meses',
  scale: FOLLOWUP_SCALE,
  sections: [], // static sections empty; always use dynamicSections at runtime
  dynamicSections,
  parentInstrumentId: 'mchat-r',
  hasQuadrants: false,
  scoringStrategy: mchatRFFollowupStrategy,
};

registerInstrument(mchatRFFollowup);
