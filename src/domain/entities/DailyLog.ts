export type LogType = 'abc' | 'mood' | 'sleep' | 'food' | 'toileting';

export interface AbcData { antecedent: string; behavior: string; consequence: string; intensity?: 1|2|3|4|5; }
export interface MoodData { level: 1|2|3|4|5; tags?: string[]; }
export interface SleepData { bedtime?: string; waketime?: string; wakings?: number; quality?: 1|2|3; }
export interface FoodData { meal?: 'cafe' | 'almoco' | 'jantar' | 'lanche'; accepted?: string[]; refused?: string[]; }
export interface ToiletingData { type?: 'urina' | 'fezes' | 'ambos'; independent?: boolean; }
export type LogData = AbcData | MoodData | SleepData | FoodData | ToiletingData;

export interface DailyLogProps {
  id: string;
  userId: string;
  childId: string;
  logType: LogType;
  occurredAt: Date;
  data: LogData;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface DailyLogSummary {
  id: string;
  childId: string;
  logType: LogType;
  occurredAt: Date;
  notes: string | null;
  createdAt: Date;
}

export class DailyLog {
  constructor(private readonly props: DailyLogProps) {}

  getId(): string { return this.props.id; }
  getUserId(): string { return this.props.userId; }
  getChildId(): string { return this.props.childId; }
  getLogType(): LogType { return this.props.logType; }
  getOccurredAt(): Date { return this.props.occurredAt; }
  getData(): LogData { return this.props.data; }
  getNotes(): string | null { return this.props.notes; }
  getCreatedAt(): Date { return this.props.createdAt; }
  getUpdatedAt(): Date { return this.props.updatedAt; }

  toJSON() {
    return {
      id: this.props.id,
      userId: this.props.userId,
      childId: this.props.childId,
      logType: this.props.logType,
      occurredAt: this.props.occurredAt,
      data: this.props.data,
      notes: this.props.notes,
      createdAt: this.props.createdAt,
      updatedAt: this.props.updatedAt,
    };
  }
}
