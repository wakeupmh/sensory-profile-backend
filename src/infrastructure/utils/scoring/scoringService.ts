export interface SectionScores {
  auditoryProcessing: number;      // Processamento AUDITIVO (items 1-8)
  visualProcessing: number;        // Processamento VISUAL (items 9-14, excluding 15)
  tactileProcessing: number;       // Processamento do TATO (items 16-26)
  movementProcessing: number;      // Processamento de MOVIMENTOS (items 27-34)
  bodyPositionProcessing: number;  // Processamento da POSIÇÃO DO CORPO (items 35-42)
  oralSensitivityProcessing: number; // Processamento de SENSIBILIDADE ORAL (items 43-52)
  behavioralResponses: number;     // CONDUTA associada ao processamento sensorial (items 53-61)
  socialEmotionalResponses: number; // Respostas SOCIOEMOCIONAIS (items 62-75)
  attentionResponses: number;      // Respostas de ATENÇÃO (items 76-85, excluding 86)
}

export interface QuadrantScores {
  registrationIncreased: number; // RA - Registro Aumentado
  sensorySeek: number; // BS - Busca Sensorial
  sensorySensitivity: number; // SS - Sensibilidade Sensorial
  sensoryAvoidance: number; // ES - Evitação Sensorial
}

export interface AssessmentResults {
  sectionScores: SectionScores;
  quadrantScores: QuadrantScores;
  totalItems: number;
  validResponses: number;
  invalidResponses: string[];
}

// Map response text to numeric value based on official Sensory Profile 2 scale
export const mapResponseToValue = (response: string): number => {
  const responseMap: Record<string, number> = {
    // Official Portuguese responses from Sensory Profile 2 form
    'quase sempre': 5,        // 90% ou mais
    'frequentemente': 4,      // 75%
    'metade do tempo': 3,     // 50%
    'ocasionalmente': 2,      // 25%
    'quase nunca': 1,         // 10% ou menos
    'não se aplica': 0,       // Not applicable - excluded from scoring
    
    // English equivalents for international compatibility
    'almost always': 5,
    'frequently': 4,
    'half the time': 3,
    'occasionally': 2,
    'almost never': 1,
    'does not apply': 0,
    
    // Legacy support (will be deprecated)
    'always': 5,
    'rarely': 2,
    'never': 1
  };
  
  const normalizedResponse = response.toLowerCase().trim();
  const value = responseMap[normalizedResponse];
  
  if (value === undefined) {
    throw new Error(`Invalid response value: "${response}". Expected: quase sempre, frequentemente, metade do tempo, ocasionalmente, quase nunca, não se aplica`);
  }
  
  return value;
};

// Complete item-to-section mapping for Sensory Profile 2 (86 items total)
const sectionMap: Record<number, keyof SectionScores> = {
  // Processamento AUDITIVO (items 1-8) - ALL count toward raw score
  1: 'auditoryProcessing', 2: 'auditoryProcessing', 3: 'auditoryProcessing',
  4: 'auditoryProcessing', 5: 'auditoryProcessing', 6: 'auditoryProcessing',
  7: 'auditoryProcessing', 8: 'auditoryProcessing',
  
  // Processamento VISUAL (items 9-15) - Item 15 does NOT count toward raw score
  9: 'visualProcessing', 10: 'visualProcessing', 11: 'visualProcessing',
  12: 'visualProcessing', 13: 'visualProcessing', 14: 'visualProcessing',
  // Item 15 exists but is excluded from scoring
  
  // Processamento do TATO (items 16-26) - ALL count toward raw score
  16: 'tactileProcessing', 17: 'tactileProcessing', 18: 'tactileProcessing',
  19: 'tactileProcessing', 20: 'tactileProcessing', 21: 'tactileProcessing',
  22: 'tactileProcessing', 23: 'tactileProcessing', 24: 'tactileProcessing',
  25: 'tactileProcessing', 26: 'tactileProcessing',
  
  // Processamento de MOVIMENTOS (items 27-34) - ALL count toward raw score
  27: 'movementProcessing', 28: 'movementProcessing', 29: 'movementProcessing',
  30: 'movementProcessing', 31: 'movementProcessing', 32: 'movementProcessing',
  33: 'movementProcessing', 34: 'movementProcessing',
  
  // Processamento da POSIÇÃO DO CORPO (items 35-42) - ALL count toward raw score
  35: 'bodyPositionProcessing', 36: 'bodyPositionProcessing', 37: 'bodyPositionProcessing',
  38: 'bodyPositionProcessing', 39: 'bodyPositionProcessing', 40: 'bodyPositionProcessing',
  41: 'bodyPositionProcessing', 42: 'bodyPositionProcessing',
  
  // Processamento de SENSIBILIDADE ORAL (items 43-52) - ALL count toward raw score
  43: 'oralSensitivityProcessing', 44: 'oralSensitivityProcessing', 45: 'oralSensitivityProcessing',
  46: 'oralSensitivityProcessing', 47: 'oralSensitivityProcessing', 48: 'oralSensitivityProcessing',
  49: 'oralSensitivityProcessing', 50: 'oralSensitivityProcessing', 51: 'oralSensitivityProcessing',
  52: 'oralSensitivityProcessing',
  
  // CONDUTA associada ao processamento sensorial (items 53-61) - ALL count toward raw score
  53: 'behavioralResponses', 54: 'behavioralResponses', 55: 'behavioralResponses',
  56: 'behavioralResponses', 57: 'behavioralResponses', 58: 'behavioralResponses',
  59: 'behavioralResponses', 60: 'behavioralResponses', 61: 'behavioralResponses',
  
  // Respostas SOCIOEMOCIONAIS (items 62-75) - ALL count toward raw score
  62: 'socialEmotionalResponses', 63: 'socialEmotionalResponses', 64: 'socialEmotionalResponses',
  65: 'socialEmotionalResponses', 66: 'socialEmotionalResponses', 67: 'socialEmotionalResponses',
  68: 'socialEmotionalResponses', 69: 'socialEmotionalResponses', 70: 'socialEmotionalResponses',
  71: 'socialEmotionalResponses', 72: 'socialEmotionalResponses', 73: 'socialEmotionalResponses',
  74: 'socialEmotionalResponses', 75: 'socialEmotionalResponses',
  
  // Respostas de ATENÇÃO (items 76-86) - Item 86 does NOT count toward raw score
  76: 'attentionResponses', 77: 'attentionResponses', 78: 'attentionResponses',
  79: 'attentionResponses', 80: 'attentionResponses', 81: 'attentionResponses',
  82: 'attentionResponses', 83: 'attentionResponses', 84: 'attentionResponses',
  85: 'attentionResponses'
  // Item 86 exists but is excluded from scoring
};

// Quadrant mapping based on official Sensory Profile 2 form color coding
// EX = Exploração (orange) = Sensory Seeking
// EV = Esquiva (blue) = Sensory Avoidance 
// SN = Sensibilidade (green) = Sensory Sensitivity
// OB = Observação (purple) = Registration Increased
const quadrantMap: Record<number, keyof QuadrantScores> = {
  // From the official form quadrant table (page 7):
  
  // EX - Exploração/Sensory Seeking (orange items)
  14: 'sensorySeek', 21: 'sensorySeek', 22: 'sensorySeek', 25: 'sensorySeek',
  27: 'sensorySeek', 28: 'sensorySeek', 30: 'sensorySeek', 31: 'sensorySeek',
  32: 'sensorySeek', 41: 'sensorySeek', 48: 'sensorySeek', 49: 'sensorySeek',
  50: 'sensorySeek', 51: 'sensorySeek', 55: 'sensorySeek', 56: 'sensorySeek',
  60: 'sensorySeek', 82: 'sensorySeek', 83: 'sensorySeek',
  
  // EV - Esquiva/Sensory Avoidance (blue items)  
  1: 'sensoryAvoidance', 2: 'sensoryAvoidance', 5: 'sensoryAvoidance',
  15: 'sensoryAvoidance', 18: 'sensoryAvoidance', 58: 'sensoryAvoidance',
  59: 'sensoryAvoidance', 61: 'sensoryAvoidance', 63: 'sensoryAvoidance',
  64: 'sensoryAvoidance', 65: 'sensoryAvoidance', 66: 'sensoryAvoidance',
  67: 'sensoryAvoidance', 68: 'sensoryAvoidance', 70: 'sensoryAvoidance',
  71: 'sensoryAvoidance', 72: 'sensoryAvoidance', 74: 'sensoryAvoidance',
  75: 'sensoryAvoidance', 81: 'sensoryAvoidance',
  
  // SN - Sensibilidade/Sensory Sensitivity (green items)
  3: 'sensorySensitivity', 6: 'sensorySensitivity', 9: 'sensorySensitivity',
  13: 'sensorySensitivity', 16: 'sensorySensitivity', 19: 'sensorySensitivity',
  20: 'sensorySensitivity', 44: 'sensorySensitivity', 45: 'sensorySensitivity',
  46: 'sensorySensitivity', 47: 'sensorySensitivity', 52: 'sensorySensitivity',
  69: 'sensorySensitivity', 73: 'sensorySensitivity', 77: 'sensorySensitivity',
  78: 'sensorySensitivity', 84: 'sensorySensitivity',
  
  // OB - Observação/Registration Increased (purple items)
  8: 'registrationIncreased', 12: 'registrationIncreased', 23: 'registrationIncreased',
  24: 'registrationIncreased', 26: 'registrationIncreased', 33: 'registrationIncreased',
  34: 'registrationIncreased', 35: 'registrationIncreased', 36: 'registrationIncreased',
  37: 'registrationIncreased', 38: 'registrationIncreased', 39: 'registrationIncreased',
  40: 'registrationIncreased', 53: 'registrationIncreased', 54: 'registrationIncreased',
  57: 'registrationIncreased', 62: 'registrationIncreased', 76: 'registrationIncreased',
  79: 'registrationIncreased', 80: 'registrationIncreased', 85: 'registrationIncreased',
  86: 'registrationIncreased'
};

// Validate item ID range for Sensory Profile 2 (86 items total)
export const validateItemId = (itemId: number): boolean => {
  return itemId >= 1 && itemId <= 86 && Number.isInteger(itemId);
};

// Check if item should be excluded from raw score calculation
export const isExcludedFromScoring = (itemId: number): boolean => {
  return itemId === 15 || itemId === 86; // These items exist but don't count toward raw scores
};

// Calculate raw scores for each section
export const calculateSectionScores = (responses: Array<{ itemId: number, response: string }>): {
  scores: SectionScores;
  invalidResponses: string[];
} => {
  const scores: SectionScores = {
    auditoryProcessing: 0,
    visualProcessing: 0,
    tactileProcessing: 0,
    movementProcessing: 0,
    bodyPositionProcessing: 0,
    oralSensitivityProcessing: 0,
    behavioralResponses: 0,
    socialEmotionalResponses: 0,
    attentionResponses: 0
  };
  
  const invalidResponses: string[] = [];
  
  responses.forEach(response => {
    try {
      // Validate item ID
      if (!validateItemId(response.itemId)) {
        invalidResponses.push(`Invalid item ID: ${response.itemId}`);
        return;
      }
      
      // Skip items that are excluded from raw score calculation
      if (isExcludedFromScoring(response.itemId)) {
        return; // Items 15 and 86 don't contribute to raw scores
      }
      
      const value = mapResponseToValue(response.response);
      
      // Skip "não se aplica" responses (value = 0) from scoring
      if (value === 0) {
        return;
      }
      
      const section = sectionMap[response.itemId];
      
      if (section) {
        scores[section] += value;
      } else {
        invalidResponses.push(`No section mapping for item ${response.itemId}`);
      }
    } catch (error) {
      invalidResponses.push(`Item ${response.itemId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  });
  
  return { scores, invalidResponses };
};

// Calculate quadrant scores based on Dunn's Model
export const calculateQuadrantScores = (responses: Array<{ itemId: number, response: string }>): {
  scores: QuadrantScores;
  invalidResponses: string[];
} => {
  const scores: QuadrantScores = {
    registrationIncreased: 0,
    sensorySeek: 0,
    sensorySensitivity: 0,
    sensoryAvoidance: 0
  };
  
  const invalidResponses: string[] = [];
  
  responses.forEach(response => {
    try {
      if (!validateItemId(response.itemId)) {
        invalidResponses.push(`Invalid item ID: ${response.itemId}`);
        return;
      }
      
      const value = mapResponseToValue(response.response);
      const quadrant = quadrantMap[response.itemId];
      
      if (quadrant) {
        scores[quadrant] += value;
      }
      // Note: Not all items contribute to quadrant scores
    } catch (error) {
      invalidResponses.push(`Item ${response.itemId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  });
  
  return { scores, invalidResponses };
};

// Main scoring function that calculates both section and quadrant scores
export const calculateScores = (responses: Array<{ itemId: number, response: string }>): AssessmentResults => {
  const sectionResult = calculateSectionScores(responses);
  const quadrantResult = calculateQuadrantScores(responses);
  
  // Combine invalid responses from both calculations
  const allInvalidResponses = [
    ...new Set([...sectionResult.invalidResponses, ...quadrantResult.invalidResponses])
  ];
  
  return {
    sectionScores: sectionResult.scores,
    quadrantScores: quadrantResult.scores,
    totalItems: responses.length,
    validResponses: responses.length - allInvalidResponses.length,
    invalidResponses: allInvalidResponses
  };
};

// Get expected score ranges for validation based on official Sensory Profile 2
export const getExpectedScoreRanges = () => {
  return {
    sectionRanges: {
      auditoryProcessing: { min: 8, max: 40 },           // 8 items × 1-5 scale
      visualProcessing: { min: 6, max: 30 },             // 6 items × 1-5 scale (excluding item 15)
      tactileProcessing: { min: 11, max: 55 },           // 11 items × 1-5 scale  
      movementProcessing: { min: 8, max: 40 },           // 8 items × 1-5 scale
      bodyPositionProcessing: { min: 8, max: 40 },       // 8 items × 1-5 scale
      oralSensitivityProcessing: { min: 10, max: 50 },   // 10 items × 1-5 scale
      behavioralResponses: { min: 9, max: 45 },          // 9 items × 1-5 scale (CONDUTA)
      socialEmotionalResponses: { min: 14, max: 70 },    // 14 items × 1-5 scale (SOCIOEMOCIONAL)
      attentionResponses: { min: 10, max: 50 }           // 10 items × 1-5 scale (excluding item 86)
    },
    totalRange: { min: 84, max: 420 } // 84 scoring items × 1-5 scale (excluding items 15 & 86)
  };
};

// Validate calculated scores against expected ranges
export const validateScores = (results: AssessmentResults): string[] => {
  const ranges = getExpectedScoreRanges();
  const warnings: string[] = [];
  
  // Validate section scores
  Object.entries(results.sectionScores).forEach(([section, score]) => {
    const range = ranges.sectionRanges[section as keyof SectionScores];
    if (score < range.min || score > range.max) {
      warnings.push(`${section} score ${score} is outside expected range ${range.min}-${range.max}`);
    }
  });
  
  // Validate total score
  const totalScore = Object.values(results.sectionScores).reduce((sum, score) => sum + score, 0);
  if (totalScore < ranges.totalRange.min || totalScore > ranges.totalRange.max) {
    warnings.push(`Total score ${totalScore} is outside expected range ${ranges.totalRange.min}-${ranges.totalRange.max}`);
  }
  
  return warnings;
};
