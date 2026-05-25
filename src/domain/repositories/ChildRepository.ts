import { Child } from '../entities/Child';

export interface ChildCreateInput {
  id: string;
  userId: string;
  name: string;
  birthDate: string;
  gender?: string;
  nationalIdentity?: string;
  otherInfo?: string;
}

export type ChildUpdateInput = Partial<Omit<ChildCreateInput, 'id' | 'userId'>>;

export interface ChildRepository {
  findByUserId(userId: string): Promise<Child[]>;
  findById(id: string, userId: string): Promise<Child | null>;
  create(input: ChildCreateInput): Promise<Child>;
  update(id: string, userId: string, input: ChildUpdateInput): Promise<Child | null>;
  delete(id: string, userId: string): Promise<boolean>;
  hasAssessments(id: string, userId: string): Promise<boolean>;
  findOrCreate(userId: string, data: {
    name: string;
    birthDate?: string;
    gender?: string;
    nationalIdentity?: string;
    otherInfo?: string;
  }): Promise<Child>;
}
