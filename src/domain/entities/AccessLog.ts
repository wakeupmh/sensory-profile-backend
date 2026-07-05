export type AccessLogAction = 'read' | 'write';

export interface AccessLogProps {
  id: string;
  actorUserId: string;
  professionalId: string | null;
  childId: string | null;
  resourceType: string;
  resourceId: string | null;
  action: AccessLogAction;
  createdAt: Date;
}

export class AccessLog {
  constructor(private readonly props: AccessLogProps) {}

  toJSON() {
    return {
      id: this.props.id,
      actorUserId: this.props.actorUserId,
      professionalId: this.props.professionalId,
      childId: this.props.childId,
      resourceType: this.props.resourceType,
      resourceId: this.props.resourceId,
      action: this.props.action,
      createdAt: this.props.createdAt,
    };
  }
}
