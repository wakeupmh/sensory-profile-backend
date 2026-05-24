import Anthropic from '@anthropic-ai/sdk';
import { ConsolidatedReportService } from './ConsolidatedReportService';

export class AISummaryService {
  constructor(private readonly consolidatedService: ConsolidatedReportService) {}

  private formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('pt-BR');
  }

  async generateSummary(userId: string, childId: string, periodDays: number = 90): Promise<string> {
    const summary = await this.consolidatedService.getSummary(userId, childId, periodDays);

    const prompt = `Você é um assistente especializado em desenvolvimento infantil de crianças neurodivergentes.

A seguir estão dados de acompanhamento do período de ${this.formatDate(summary.period.from)} a ${this.formatDate(summary.period.to)} para ${summary.child.name}.

AVALIAÇÕES (${summary.assessments.count} total):
${summary.assessments.recent.slice(0, 3).map((a) => `- ${a.instrumentId} em ${a.completedAt ? this.formatDate(a.completedAt) : 'sem data'}`).join('\n') || 'Nenhuma avaliação no período'}

TERAPIA (${summary.therapy.sessionCount} sessões):
Tipos: ${Object.entries(summary.therapy.byType).map(([k, v]) => `${k}: ${v}x`).join(', ') || 'Nenhuma'}
Terapeutas ativos: ${summary.therapy.activeTherapists.map((t) => `${t.name} (${t.specialty})`).join(', ') || 'Nenhum'}

REGISTROS DIÁRIOS (${summary.logs.totalCount} total):
${Object.entries(summary.logs.byType).map(([k, v]) => `${k}: ${v}x`).join(', ') || 'Nenhum'}

MEDICAMENTOS ATIVOS: ${summary.medical.activeMedications.map((m) => m.name).join(', ') || 'Nenhum'}

COMORBIDADES: ${summary.medical.comorbidities.map((c) => c.conditionName).join(', ') || 'Nenhuma'}

MARCOS DE DESENVOLVIMENTO:
- Alcançados: ${summary.development.milestoneStats.achieved}
- Em progresso: ${summary.development.milestoneStats.inProgress}
- Não iniciados: ${summary.development.milestoneStats.notYet}
${summary.development.milestoneStats.regressed > 0 ? `- Em regressão: ${summary.development.milestoneStats.regressed}` : ''}

PLANOS EDUCACIONAIS: ${summary.education.plans.map((p) => `${p.planType} (${p.schoolName})`).join(', ') || 'Nenhum'}

Gere um resumo trimestral conciso (200-300 palavras) em português brasileiro para compartilhar com a equipe terapêutica. Destaque: progressos observados, áreas que precisam de atenção, consistência no acompanhamento terapêutico, e sugestões gerais. Tom: objetivo, clínico mas acessível.`;

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY não configurada');

    const client = new Anthropic({ apiKey });
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    });

    const block = message.content[0];
    if (block.type !== 'text') throw new Error('Resposta inválida da IA');
    return block.text;
  }
}
