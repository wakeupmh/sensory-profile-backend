import { Entity } from './Entity';

export interface ReportShareProps {
  id: string;
  userId: string;
  childId: string;
  token: string;
  periodDays: number;
  expiresAt: Date;
  createdAt: Date;
}

export class ReportShare extends Entity<ReportShareProps, 'token'> {
  /**
   * O token é a capacidade: quem o tem lê o relatório da criança sem login.
   * Ele saía em `toJSON()`, e a listagem mapeava por ali — então cada
   * `GET /shares` devolvia o token vivo de TODO compartilhamento, para
   * qualquer coisa que lesse aquela resposta (cache, histórico, log de rede).
   * Agora sai só por `toOwnerView()`, no endpoint que o dono chama ao clicar
   * em copiar, um compartilhamento de cada vez.
   */
  protected hiddenFields() {
    return ['token'] as const;
  }

  toOwnerView() {
    return { ...this.props };
  }


  getId(): string { return this.props.id; }
  getUserId(): string { return this.props.userId; }
  getChildId(): string { return this.props.childId; }
  getToken(): string { return this.props.token; }
  getPeriodDays(): number { return this.props.periodDays; }
  getExpiresAt(): Date { return this.props.expiresAt; }
  getCreatedAt(): Date { return this.props.createdAt; }

}
