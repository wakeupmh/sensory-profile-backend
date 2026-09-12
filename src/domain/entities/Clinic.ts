import { Entity } from './Entity';

/**
 * Uma clínica. É só a organização — o quadro vive em `ClinicMember`, e nem uma
 * nem outra alcança dado de criança. Ver `ClinicMember` para o porquê.
 */
export interface ClinicProps {
  id: string;
  name: string;
  createdByUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export class Clinic extends Entity<ClinicProps> {
  getId(): string { return this.props.id; }
  getName(): string { return this.props.name; }
  getCreatedByUserId(): string | null { return this.props.createdByUserId; }
}
