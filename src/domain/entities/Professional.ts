export interface ProfessionalProps {
  id: string;
  ownerUserId: string;
  name: string;
  email: string | null;
  profession: string | null;
  invitationToken: string | null;
  invitationExpiresAt: Date | null;
  acceptedUserId: string | null;
  acceptedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export type ProfessionalStatus = 'pending' | 'accepted';

export class Professional {
  readonly id: string;
  readonly ownerUserId: string;
  name: string;
  email: string | null;
  profession: string | null;
  invitationToken: string | null;
  invitationExpiresAt: Date | null;
  acceptedUserId: string | null;
  acceptedAt: Date | null;
  readonly createdAt: Date;
  updatedAt: Date;

  constructor(props: ProfessionalProps) {
    this.id = props.id;
    this.ownerUserId = props.ownerUserId;
    this.name = props.name;
    this.email = props.email;
    this.profession = props.profession;
    this.invitationToken = props.invitationToken;
    this.invitationExpiresAt = props.invitationExpiresAt;
    this.acceptedUserId = props.acceptedUserId;
    this.acceptedAt = props.acceptedAt;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  get status(): ProfessionalStatus {
    return this.acceptedUserId ? 'accepted' : 'pending';
  }

  /**
   * A listagem, SEM o token do convite.
   *
   * A listagem devolvia `toOwnerView()`, então cada `GET /api/professionals`
   * trazia o token vivo de todo convite pendente — o mesmo problema que
   * `CaregiverShare` já tinha corrigido do seu lado, e que aqui passou porque
   * esta entidade tinha uma view só, usada por todos os endpoints.
   *
   * O token continua saindo em `toOwnerView()`, que é o que a criação, a
   * consulta por id e a rotação devolvem — os três momentos em que o dono
   * pediu o código. Precisando de um link novo, existe `rotate-token`.
   */
  toListView() {
    const { invitationToken: _token, ...rest } = this.toOwnerView();
    return rest;
  }

  toOwnerView() {
    return {
      id: this.id,
      name: this.name,
      email: this.email,
      profession: this.profession,
      status: this.status,
      invitationToken: this.invitationToken,
      invitationExpiresAt: this.invitationExpiresAt,
      acceptedAt: this.acceptedAt,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
