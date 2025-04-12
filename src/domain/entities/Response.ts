export class Response {
  constructor(
    private assessmentId: string,
    private itemId: number,
    private response: string,
    private id?: string,
    private createdAt?: Date,
    private updatedAt?: Date
  ) {}

  getId(): string | undefined {
    return this.id;
  }

  getAssessmentId(): string {
    return this.assessmentId;
  }

  getItemId(): number {
    return this.itemId;
  }

  getResponse(): string {
    return this.response;
  }

  getCreatedAt(): Date | undefined {
    return this.createdAt;
  }

  getUpdatedAt(): Date | undefined {
    return this.updatedAt;
  }

  setResponse(response: string): void {
    this.response = response;
    this.updatedAt = new Date();
  }
}
