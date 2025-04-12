export class Assessment {
  constructor(
    private childId: string,
    private examinerId: string | null,
    private caregiverId: string | null,
    private assessmentDate: Date,
    private auditoryProcessingRawScore?: number,
    private visualProcessingRawScore?: number,
    private tactileProcessingRawScore?: number,
    private movementProcessingRawScore?: number,
    private bodyPositionProcessingRawScore?: number,
    private oralSensitivityProcessingRawScore?: number,
    private socialEmotionalResponsesRawScore?: number,
    private attentionResponsesRawScore?: number,
    private id?: string,
    private createdAt?: Date,
    private updatedAt?: Date
  ) {}

  getId(): string | undefined {
    return this.id;
  }

  getChildId(): string {
    return this.childId;
  }

  getExaminerId(): string | null {
    return this.examinerId;
  }

  getCaregiverId(): string | null {
    return this.caregiverId;
  }

  getAssessmentDate(): Date {
    return this.assessmentDate;
  }

  getAuditoryProcessingRawScore(): number | undefined {
    return this.auditoryProcessingRawScore;
  }

  getVisualProcessingRawScore(): number | undefined {
    return this.visualProcessingRawScore;
  }

  getTactileProcessingRawScore(): number | undefined {
    return this.tactileProcessingRawScore;
  }

  getMovementProcessingRawScore(): number | undefined {
    return this.movementProcessingRawScore;
  }

  getBodyPositionProcessingRawScore(): number | undefined {
    return this.bodyPositionProcessingRawScore;
  }

  getOralSensitivityProcessingRawScore(): number | undefined {
    return this.oralSensitivityProcessingRawScore;
  }

  getSocialEmotionalResponsesRawScore(): number | undefined {
    return this.socialEmotionalResponsesRawScore;
  }

  getAttentionResponsesRawScore(): number | undefined {
    return this.attentionResponsesRawScore;
  }

  getCreatedAt(): Date | undefined {
    return this.createdAt;
  }

  getUpdatedAt(): Date | undefined {
    return this.updatedAt;
  }

  // Setters
  setAuditoryProcessingRawScore(score: number): void {
    this.auditoryProcessingRawScore = score;
    this.updatedAt = new Date();
  }

  setVisualProcessingRawScore(score: number): void {
    this.visualProcessingRawScore = score;
    this.updatedAt = new Date();
  }

  setTactileProcessingRawScore(score: number): void {
    this.tactileProcessingRawScore = score;
    this.updatedAt = new Date();
  }

  setMovementProcessingRawScore(score: number): void {
    this.movementProcessingRawScore = score;
    this.updatedAt = new Date();
  }

  setBodyPositionProcessingRawScore(score: number): void {
    this.bodyPositionProcessingRawScore = score;
    this.updatedAt = new Date();
  }

  setOralSensitivityProcessingRawScore(score: number): void {
    this.oralSensitivityProcessingRawScore = score;
    this.updatedAt = new Date();
  }

  setSocialEmotionalResponsesRawScore(score: number): void {
    this.socialEmotionalResponsesRawScore = score;
    this.updatedAt = new Date();
  }

  setAttentionResponsesRawScore(score: number): void {
    this.attentionResponsesRawScore = score;
    this.updatedAt = new Date();
  }
}
