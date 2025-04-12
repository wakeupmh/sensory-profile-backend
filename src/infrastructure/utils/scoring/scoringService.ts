// Map response text to numeric value
export const mapResponseToValue = (response: string): number => {
  const responseMap: Record<string, number> = {
    'always': 5,
    'frequently': 4,
    'occasionally': 3,
    'rarely': 2,
    'never': 1
  };
  
  return responseMap[response.toLowerCase()] || 0;
};

// Define item sections
const sectionMap: Record<number, string> = {
  // Auditory Processing (items 1-8)
  1: 'auditoryProcessing', 2: 'auditoryProcessing', 3: 'auditoryProcessing',
  4: 'auditoryProcessing', 5: 'auditoryProcessing', 6: 'auditoryProcessing',
  7: 'auditoryProcessing', 8: 'auditoryProcessing',
  
  // Visual Processing (items 9-19)
  9: 'visualProcessing', 10: 'visualProcessing', 11: 'visualProcessing',
  12: 'visualProcessing', 13: 'visualProcessing', 14: 'visualProcessing',
  15: 'visualProcessing', 16: 'visualProcessing', 17: 'visualProcessing',
  18: 'visualProcessing', 19: 'visualProcessing',
  
  // Tactile Processing (items 20-37)
  // ... and so on for all sections
};

// Calculate raw scores for each section
export const calculateScores = (responses: Array<{ itemId: number, response: string }>) => {
  // Initialize scores for each section
  const scores = {
    auditoryProcessing: 0,
    visualProcessing: 0,
    tactileProcessing: 0,
    movementProcessing: 0,
    bodyPositionProcessing: 0,
    oralSensitivityProcessing: 0,
    socialEmotionalResponses: 0,
    attentionResponses: 0
  };
  
  // Map responses to values and sum by section
  responses.forEach(response => {
    const value = mapResponseToValue(response.response);
    const section = sectionMap[response.itemId];
    
    if (section && section in scores) {
      scores[section as keyof typeof scores] += value;
    }
  });
  
  return scores;
};

// This is a placeholder for more complex scoring logic
// In a real implementation, you would add more functions for:
// - Calculating quadrant scores
// - Determining percentile ranks
// - Interpreting scores based on normative data
// - Generating recommendations based on scores
