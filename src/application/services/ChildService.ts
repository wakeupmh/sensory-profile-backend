import { v7 as uuidv7 } from 'uuid';
import { Child } from '../../domain/entities/Child';
import { ChildRepository, ChildUpdateInput } from '../../domain/repositories/ChildRepository';
import { PgChildRepository } from '../../infrastructure/repositories/PgChildRepository';

export interface ChildData {
  name: string;
  birthDate: string;
  gender?: string;
  nationalIdentity?: string;
  otherInfo?: string;
}

export class ChildService {
  private readonly repo: ChildRepository;

  constructor(repo?: ChildRepository) {
    this.repo = repo ?? new PgChildRepository();
  }

  // ── Legacy methods used by AssessmentService ──────────────────────────────

  async findOrCreateChild(childData: ChildData, userId: string): Promise<string> {
    const child = await this.repo.findOrCreate(userId, childData);
    return child.getId();
  }

  async getChildById(childId: string, userId: string): Promise<(ChildData & { id: string }) | null> {
    const child = await this.repo.findById(childId, userId);
    if (!child) return null;
    return {
      id: child.getId(),
      name: child.getName(),
      birthDate: child.getBirthDate(),
      gender: child.getGender() ?? undefined,
      nationalIdentity: child.getNationalIdentity() ?? undefined,
      otherInfo: child.getOtherInfo() ?? undefined,
    };
  }

  async getAllChildren(userId: string): Promise<Array<ChildData & { id: string }>> {
    const children = await this.repo.findByUserId(userId);
    return children.map(child => ({
      id: child.getId(),
      name: child.getName(),
      birthDate: child.getBirthDate(),
      gender: child.getGender() ?? undefined,
      nationalIdentity: child.getNationalIdentity() ?? undefined,
      otherInfo: child.getOtherInfo() ?? undefined,
    }));
  }

  // ── New CRUD methods ───────────────────────────────────────────────────────

  async list(userId: string): Promise<Child[]> {
    return this.repo.findByUserId(userId);
  }

  async get(id: string, userId: string): Promise<Child | null> {
    return this.repo.findById(id, userId);
  }

  async create(userId: string, input: ChildData): Promise<Child> {
    return this.repo.create({
      id: uuidv7(),
      userId,
      name: input.name,
      birthDate: input.birthDate,
      gender: input.gender,
      nationalIdentity: input.nationalIdentity,
      otherInfo: input.otherInfo,
    });
  }

  async update(id: string, userId: string, input: ChildUpdateInput): Promise<Child | null> {
    return this.repo.update(id, userId, input);
  }

  async delete(id: string, userId: string): Promise<boolean> {
    return this.repo.delete(id, userId);
  }
}
