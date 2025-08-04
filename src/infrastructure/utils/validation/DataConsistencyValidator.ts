import { Assessment } from '../../../domain/entities/Assessment';
import { Response } from '../../../domain/entities/Response';
import { 
  DataConsistencyError, 
  ValidationError,
  BusinessLogicError 
} from '../errors/CustomErrors';
import { 
  calculateScores, 
  validateScores, 
  AssessmentResults,
  SectionScores 
} from '../scoring/scoringService';
import logger from '../logger';

export interface ConsistencyCheckResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  checkedFields: string[];
}

export class DataConsistencyValidator {
  
  /**
   * Validate that an assessment's raw scores match calculated scores from responses
   */
  static validateAssessmentScoreConsistency(
    assessment: Assessment,
    responses: Response[]
  ): ConsistencyCheckResult {
    const result: ConsistencyCheckResult = {
      isValid: true,
      errors: [],
      warnings: [],
      checkedFields: []
    };

    try {
      // Convert responses to the format expected by scoring service
      const responseData = responses.map(r => ({
        itemId: r.getItemId(),
        response: r.getResponse()
      }));

      // Calculate scores from responses
      const calculatedResults = calculateScores(responseData);
      
      // Get stored scores from assessment
      const storedScores: SectionScores = {
        auditoryProcessing: assessment.getAuditoryProcessingRawScore() || 0,
        visualProcessing: assessment.getVisualProcessingRawScore() || 0,
        tactileProcessing: assessment.getTactileProcessingRawScore() || 0,
        movementProcessing: assessment.getMovementProcessingRawScore() || 0,
        bodyPositionProcessing: assessment.getBodyPositionProcessingRawScore() || 0,
        oralSensitivityProcessing: assessment.getOralSensitivityProcessingRawScore() || 0,
        behavioralResponses: assessment.getBehavioralResponsesRawScore() || 0,
        socialEmotionalResponses: assessment.getSocialEmotionalResponsesRawScore() || 0,
        attentionResponses: assessment.getAttentionResponsesRawScore() || 0
      };

      // Compare each section score
      Object.entries(storedScores).forEach(([section, storedScore]) => {
        const calculatedScore = calculatedResults.sectionScores[section as keyof SectionScores];
        result.checkedFields.push(`${section}Score`);
        
        if (storedScore !== calculatedScore) {
          const error = `${section} score mismatch: stored=${storedScore}, calculated=${calculatedScore}`;
          result.errors.push(error);
          result.isValid = false;
        }
      });

      // Check for invalid responses
      if (calculatedResults.invalidResponses.length > 0) {
        result.errors.push(`Invalid responses detected: ${calculatedResults.invalidResponses.join(', ')}`);
        result.isValid = false;
      }

      // Validate score ranges
      const scoreWarnings = validateScores(calculatedResults);
      if (scoreWarnings.length > 0) {
        result.warnings.push(...scoreWarnings);
      }

      logger.debug('Assessment score consistency check completed', {
        assessmentId: assessment.getId(),
        isValid: result.isValid,
        errorCount: result.errors.length,
        warningCount: result.warnings.length
      });

    } catch (error) {
      result.errors.push(`Score consistency check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      result.isValid = false;
      
      logger.error('Assessment score consistency check error', {
        assessmentId: assessment.getId(),
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }

    return result;
  }

  /**
   * Validate child age consistency with birth date
   */
  static validateChildAgeConsistency(birthDate: Date, expectedAge?: number): ConsistencyCheckResult {
    const result: ConsistencyCheckResult = {
      isValid: true,
      errors: [],
      warnings: [],
      checkedFields: ['birthDate', 'age']
    };

    try {
      const today = new Date();
      const birth = new Date(birthDate);
      
      // Calculate age
      let calculatedAge = today.getFullYear() - birth.getFullYear();
      const monthDiff = today.getMonth() - birth.getMonth();
      
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
        calculatedAge--;
      }

      // Check if birth date is in the future
      if (birth > today) {
        result.errors.push('Birth date cannot be in the future');
        result.isValid = false;
      }

      // Check age range for sensory profile assessment
      if (calculatedAge < 3 || calculatedAge > 14) {
        result.errors.push(`Child age ${calculatedAge} is outside valid range (3-14 years)`);
        result.isValid = false;
      }

      // If expected age is provided, validate consistency
      if (expectedAge !== undefined && expectedAge !== calculatedAge) {
        result.warnings.push(`Age mismatch: expected=${expectedAge}, calculated=${calculatedAge}`);
      }

    } catch (error) {
      result.errors.push(`Age consistency check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      result.isValid = false;
    }

    return result;
  }

  /**
   * Validate response completeness for each section
   */
  static validateResponseCompleteness(responses: Response[]): ConsistencyCheckResult {
    const result: ConsistencyCheckResult = {
      isValid: true,
      errors: [],
      warnings: [],
      checkedFields: ['responses']
    };

    try {
      const sectionItemCounts = {
        auditoryProcessing: { min: 1, max: 8, actual: 0, range: [1, 8] },
        visualProcessing: { min: 9, max: 14, actual: 0, range: [9, 14] }, // excluding 15
        tactileProcessing: { min: 16, max: 26, actual: 0, range: [16, 26] },
        movementProcessing: { min: 27, max: 34, actual: 0, range: [27, 34] },
        bodyPositionProcessing: { min: 35, max: 42, actual: 0, range: [35, 42] },
        oralSensitivityProcessing: { min: 43, max: 52, actual: 0, range: [43, 52] },
        behavioralResponses: { min: 53, max: 61, actual: 0, range: [53, 61] },
        socialEmotionalResponses: { min: 62, max: 75, actual: 0, range: [62, 75] },
        attentionResponses: { min: 76, max: 85, actual: 0, range: [76, 85] } // excluding 86
      };

      // Count responses per section
      responses.forEach(response => {
        const itemId = response.getItemId();
        
        Object.entries(sectionItemCounts).forEach(([section, info]) => {
          const [minId, maxId] = info.range;
          if (itemId >= minId && itemId <= maxId) {
            info.actual++;
          }
        });
      });

      // Check for missing or incomplete sections
      Object.entries(sectionItemCounts).forEach(([section, info]) => {
        const expectedCount = info.max - info.min + 1;
        const completionPercentage = (info.actual / expectedCount) * 100;
        
        if (info.actual === 0) {
          result.errors.push(`No responses found for ${section} section`);
          result.isValid = false;
        } else if (completionPercentage < 75) {
          result.warnings.push(
            `${section} section is ${completionPercentage.toFixed(1)}% complete (${info.actual}/${expectedCount} items)`
          );
        }
      });

      // Check for duplicate responses
      const itemIds = responses.map(r => r.getItemId());
      const uniqueIds = new Set(itemIds);
      if (uniqueIds.size !== itemIds.length) {
        const duplicates = itemIds.filter((id, index) => itemIds.indexOf(id) !== index);
        result.errors.push(`Duplicate responses found for items: ${[...new Set(duplicates)].join(', ')}`);
        result.isValid = false;
      }

      // Check for out-of-range item IDs
      const invalidIds = itemIds.filter(id => id < 1 || id > 86);
      if (invalidIds.length > 0) {
        result.errors.push(`Invalid item IDs found: ${invalidIds.join(', ')}`);
        result.isValid = false;
      }

    } catch (error) {
      result.errors.push(`Response completeness check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      result.isValid = false;
    }

    return result;
  }

  /**
   * Validate assessment date consistency
   */
  static validateAssessmentDateConsistency(
    assessmentDate: Date,
    childBirthDate: Date,
    createdAt?: Date
  ): ConsistencyCheckResult {
    const result: ConsistencyCheckResult = {
      isValid: true,
      errors: [],
      warnings: [],
      checkedFields: ['assessmentDate', 'childBirthDate', 'createdAt']
    };

    try {
      const today = new Date();
      const assessment = new Date(assessmentDate);
      const birth = new Date(childBirthDate);

      // Assessment date cannot be in the future
      if (assessment > today) {
        result.errors.push('Assessment date cannot be in the future');
        result.isValid = false;
      }

      // Assessment date cannot be before child's birth
      if (assessment < birth) {
        result.errors.push('Assessment date cannot be before child\'s birth date');
        result.isValid = false;
      }

      // Check if assessment date is reasonable (not too old)
      const daysDifference = Math.floor((today.getTime() - assessment.getTime()) / (1000 * 60 * 60 * 24));
      if (daysDifference > 365 * 2) { // More than 2 years old
        result.warnings.push(`Assessment is ${Math.floor(daysDifference / 365)} years old`);
      }

      // If createdAt is provided, assessment date should not be significantly different
      if (createdAt) {
        const created = new Date(createdAt);
        const timeDifference = Math.abs(assessment.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);
        
        if (timeDifference > 30) { // More than 30 days difference
          result.warnings.push(`Assessment date differs from creation date by ${Math.floor(timeDifference)} days`);
        }
      }

    } catch (error) {
      result.errors.push(`Date consistency check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      result.isValid = false;
    }

    return result;
  }

  /**
   * Comprehensive validation of an assessment with all its data
   */
  static validateFullAssessment(
    assessment: Assessment,
    responses: Response[],
    childBirthDate?: Date
  ): ConsistencyCheckResult {
    const result: ConsistencyCheckResult = {
      isValid: true,
      errors: [],
      warnings: [],
      checkedFields: []
    };

    try {
      // Run all individual checks
      const checks = [
        this.validateAssessmentScoreConsistency(assessment, responses),
        this.validateResponseCompleteness(responses)
      ];

      // Add birth date checks if available
      if (childBirthDate) {
        checks.push(
          this.validateChildAgeConsistency(childBirthDate),
          this.validateAssessmentDateConsistency(
            assessment.getAssessmentDate(),
            childBirthDate,
            assessment.getCreatedAt()
          )
        );
      }

      // Combine all results
      checks.forEach(check => {
        result.errors.push(...check.errors);
        result.warnings.push(...check.warnings);
        result.checkedFields.push(...check.checkedFields);
        
        if (!check.isValid) {
          result.isValid = false;
        }
      });

      // Remove duplicate checked fields
      result.checkedFields = [...new Set(result.checkedFields)];

      logger.info('Full assessment validation completed', {
        assessmentId: assessment.getId(),
        isValid: result.isValid,
        errorCount: result.errors.length,
        warningCount: result.warnings.length,
        checkedFields: result.checkedFields.length
      });

    } catch (error) {
      result.errors.push(`Full assessment validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      result.isValid = false;
      
      logger.error('Full assessment validation error', {
        assessmentId: assessment.getId(),
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }

    return result;
  }

  /**
   * Throw appropriate errors based on validation results
   */
  static throwIfInvalid(validationResult: ConsistencyCheckResult, context?: string): void {
    if (!validationResult.isValid) {
      const contextPrefix = context ? `${context}: ` : '';
      throw new DataConsistencyError(
        `${contextPrefix}${validationResult.errors.join('; ')}`,
        'multiple_fields',
        validationResult.errors,
        validationResult.warnings
      );
    }

    // Log warnings even if validation passes
    if (validationResult.warnings.length > 0) {
      logger.warn('Data consistency warnings detected', {
        context,
        warnings: validationResult.warnings
      });
    }
  }
}