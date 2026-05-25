export interface ResponseOption {
  value: string;       // e.g. 'quase sempre', 'sim', '0', '1'
  label: string;       // PT-BR display text
  numeric: number;     // numeric score for this option
}

export interface ResponseScale {
  id: string;
  options: ResponseOption[];
}

export interface ClassificationBand {
  label: string;
  /** Absolute raw-score threshold (inclusive upper bound). Mutually exclusive with maxScorePct. */
  maxScoreAbs?: number;
  /** Proportional threshold, 0..1, applied to the section's max possible score. */
  maxScorePct?: number;
  /** CSS color used in the report (e.g. '#6a994e'). */
  color?: string;
}

export interface InstrumentSection {
  key: string;
  label: string;       // PT-BR display text
  itemIds: number[];
  /** Overrides the instrument's defaultBands for this section. */
  bands?: ClassificationBand[];
  /**
   * Subset of parent scale option values valid for this section.
   * Used when a section has a narrower response range than the instrument's full scale.
   */
  allowedValues?: string[];
}

export interface ScoringResult {
  scores_json: Record<string, unknown>;
  rawTotal?: number;
  classification?: string;
  perSection?: Record<string, number>;
}

/**
 * responses: Map from itemId (number) to response string value.
 * instrument: the Instrument being scored.
 */
export type ScoringStrategy = (
  responses: Map<number, string>,
  instrument: Instrument
) => ScoringResult;

export interface Instrument {
  id: string;
  name: string;
  shortName?: string;
  ageRange?: string;
  sections: InstrumentSection[];
  scale: ResponseScale;
  scoringStrategy: ScoringStrategy;
  /** true only for crianca-3-14 and crianca-pequena; gates old SP-2 code paths */
  legacy?: boolean;
  /** Dunn model quadrant report; SP-2 only */
  hasQuadrants?: boolean;
  defaultBands?: ClassificationBand[];
  /** M-CHAT-R can spawn a follow-up */
  allowsLinkedFollowup?: boolean;
  /** Follow-up instruments point to their parent */
  parentInstrumentId?: string;
  /**
   * For instruments where sections depend on parent assessment data.
   * E.g. M-CHAT-R/F follow-up builds steps from parent's failedItemIds.
   */
  dynamicSections?: (parent: { scores_json: Record<string, unknown> }) => InstrumentSection[];
}
