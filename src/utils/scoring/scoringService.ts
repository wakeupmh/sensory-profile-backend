import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export enum ResponseValue {
  NEVER = 1,
  RARELY = 2,
  OCCASIONALLY = 3,
  FREQUENTLY = 4,
  ALWAYS = 5
}

export type ScoredResponse = {
  itemId: number;
  value: number;
};

export type SectionScores = {
  auditoryProcessing: number;
  visualProcessing: number;
  tactileProcessing: number;
  movementProcessing: number;
  bodyPositionProcessing: number;
  oralSensitivityProcessing: number;
  socialEmotionalResponses: number;
  attentionResponses: number;
};

export type QuadrantScores = {
  registration: number; // RA - Registro Aumentado
  seeking: number;      // BS - Busca Sensorial
  sensitivity: number;  // SS - Sensibilidade Sensorial
  avoiding: number;     // ES - Evitação Sensorial
};

export type AssessmentScores = {
  sectionScores: SectionScores;
  quadrantScores: QuadrantScores;
  rawTotal: number;
};

/**
 * Calcula as pontuações brutas para uma avaliação
 * @param responses Array de respostas com itemId e resposta textual
 * @returns Objeto com pontuações por seção e por quadrante
 */
export const calculateRawScores = async (
  responses: Array<{ itemId: number; response: string }>
): Promise<AssessmentScores> => {
  // Mapear respostas para valores numéricos
  const scoredResponses = responses.map(response => ({
    itemId: response.itemId,
    value: mapResponseToValue(response.response)
  }));

  // Buscar todos os itens do banco de dados para obter seções e quadrantes
  const items = await prisma.sensoryItem.findMany();
  
  // Calcular pontuações por seção
  const sectionScores = {
    auditoryProcessing: calculateSectionScore(scoredResponses, items, 'auditoryProcessing'),
    visualProcessing: calculateSectionScore(scoredResponses, items, 'visualProcessing'),
    tactileProcessing: calculateSectionScore(scoredResponses, items, 'tactileProcessing'),
    movementProcessing: calculateSectionScore(scoredResponses, items, 'movementProcessing'),
    bodyPositionProcessing: calculateSectionScore(scoredResponses, items, 'bodyPositionProcessing'),
    oralSensitivityProcessing: calculateSectionScore(scoredResponses, items, 'oralSensitivityProcessing'),
    socialEmotionalResponses: calculateSectionScore(scoredResponses, items, 'socialEmotionalResponses'),
    attentionResponses: calculateSectionScore(scoredResponses, items, 'attentionResponses')
  };

  // Calcular pontuações por quadrante
  const quadrantScores = {
    registration: calculateQuadrantScore(scoredResponses, items, 'RA'),
    seeking: calculateQuadrantScore(scoredResponses, items, 'BS'),
    sensitivity: calculateQuadrantScore(scoredResponses, items, 'SS'),
    avoiding: calculateQuadrantScore(scoredResponses, items, 'ES')
  };

  // Calcular pontuação total bruta
  const rawTotal = Object.values(sectionScores).reduce((sum, score) => sum + score, 0);

  return {
    sectionScores,
    quadrantScores,
    rawTotal
  };
};

/**
 * Mapeia uma resposta textual para um valor numérico
 */
const mapResponseToValue = (response: string): number => {
  switch (response.toLowerCase()) {
    case 'always':
    case 'sempre':
      return ResponseValue.ALWAYS;
    case 'frequently':
    case 'frequentemente':
      return ResponseValue.FREQUENTLY;
    case 'occasionally':
    case 'ocasionalmente':
      return ResponseValue.OCCASIONALLY;
    case 'rarely':
    case 'raramente':
      return ResponseValue.RARELY;
    case 'never':
    case 'nunca':
      return ResponseValue.NEVER;
    default:
      throw new Error(`Resposta inválida: ${response}`);
  }
};

/**
 * Calcula a pontuação para uma seção específica
 */
const calculateSectionScore = (
  responses: ScoredResponse[],
  items: any[],
  section: string
): number => {
  // Filtrar itens da seção
  const sectionItems = items.filter(item => item.section === section);
  
  // Somar pontuações dos itens da seção
  let sectionScore = 0;
  
  sectionItems.forEach(item => {
    const response = responses.find(r => r.itemId === item.id);
    if (response) {
      sectionScore += response.value;
    }
  });
  
  return sectionScore;
};

/**
 * Calcula a pontuação para um quadrante específico
 */
const calculateQuadrantScore = (
  responses: ScoredResponse[],
  items: any[],
  quadrant: string
): number => {
  // Filtrar itens do quadrante
  const quadrantItems = items.filter(item => item.quadrant === quadrant);
  
  // Somar pontuações dos itens do quadrante
  let quadrantScore = 0;
  
  quadrantItems.forEach(item => {
    const response = responses.find(r => r.itemId === item.id);
    if (response) {
      quadrantScore += response.value;
    }
  });
  
  return quadrantScore;
};

/**
 * Classifica uma pontuação com base em tabelas normativas
 * Nota: As tabelas normativas reais precisariam ser implementadas
 */
export const classifyScore = (score: number, section: string, age: number): string => {
  // Implementar lógica de classificação baseada em tabelas normativas
  // Esta é uma implementação simplificada para exemplo
  if (score < 20) {
    return 'Típico';
  } else if (score < 30) {
    return 'Diferença Provável';
  } else {
    return 'Diferença Definitiva';
  }
};

/**
 * Gera um relatório completo para uma avaliação
 */
export const generateAssessmentReport = async (assessmentId: number) => {
  // Buscar a avaliação completa com todas as respostas
  const assessment = await prisma.sensoryAssessment.findUnique({
    where: { id: assessmentId },
    include: {
      child: true,
      examiner: true,
      caregiver: true,
      responses: {
        include: {
          item: true
        }
      },
      comments: true
    }
  });

  if (!assessment) {
    throw new Error('Avaliação não encontrada');
  }

  // Preparar as respostas para cálculo de pontuação
  const responsesForScoring = assessment.responses.map(r => ({
    itemId: r.itemId,
    response: r.response
  }));

  // Calcular pontuações
  const scores = await calculateRawScores(responsesForScoring);

  // Calcular idade da criança
  const birthDate = assessment.child.birthDate;
  const assessmentDate = assessment.assessmentDate;
  const ageInYears = Math.floor(
    (assessmentDate.getTime() - birthDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25)
  );

  // Classificar pontuações
  const classifications = {
    auditoryProcessing: classifyScore(
      scores.sectionScores.auditoryProcessing,
      'auditoryProcessing',
      ageInYears
    ),
    visualProcessing: classifyScore(
      scores.sectionScores.visualProcessing,
      'visualProcessing',
      ageInYears
    ),
    tactileProcessing: classifyScore(
      scores.sectionScores.tactileProcessing,
      'tactileProcessing',
      ageInYears
    ),
    movementProcessing: classifyScore(
      scores.sectionScores.movementProcessing,
      'movementProcessing',
      ageInYears
    ),
    bodyPositionProcessing: classifyScore(
      scores.sectionScores.bodyPositionProcessing,
      'bodyPositionProcessing',
      ageInYears
    ),
    oralSensitivityProcessing: classifyScore(
      scores.sectionScores.oralSensitivityProcessing,
      'oralSensitivityProcessing',
      ageInYears
    ),
    socialEmotionalResponses: classifyScore(
      scores.sectionScores.socialEmotionalResponses,
      'socialEmotionalResponses',
      ageInYears
    ),
    attentionResponses: classifyScore(
      scores.sectionScores.attentionResponses,
      'attentionResponses',
      ageInYears
    )
  };

  // Gerar relatório completo
  return {
    assessmentInfo: {
      id: assessment.id,
      date: assessment.assessmentDate,
      child: assessment.child,
      examiner: assessment.examiner,
      caregiver: assessment.caregiver
    },
    scores: scores,
    classifications: classifications,
    comments: assessment.comments
  };
};

export default {
  calculateRawScores,
  classifyScore,
  generateAssessmentReport
};
