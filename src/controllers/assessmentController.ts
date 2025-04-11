import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import scoringService from '../utils/scoring/scoringService';

const prisma = new PrismaClient();

/**
 * Controlador para gerenciar avaliações do Perfil Sensorial 2
 */
export const assessmentController = {
  /**
   * Obter todas as avaliações
   */
  getAllAssessments: async (req: Request, res: Response) => {
    try {
      const assessments = await prisma.sensoryAssessment.findMany({
        include: {
          child: true,
          examiner: true,
          caregiver: true
        }
      });
      
      res.status(200).json(assessments);
    } catch (error: any) {
      res.status(500).json({ message: 'Erro ao buscar avaliações', error: error.message });
    }
  },

  /**
   * Obter uma avaliação específica por ID
   */
  getAssessmentById: async (req: Request, res: Response) => {
    const { id } = req.params;
    
    try {
      const assessment = await prisma.sensoryAssessment.findUnique({
        where: { id: Number(id) },
        include: {
          child: true,
          examiner: true,
          caregiver: true,
          responses: {
            include: {
              item: true
            }
          },
          comments: true
        }
      });
      
      if (!assessment) {
        return res.status(404).json({ message: 'Avaliação não encontrada' });
      }
      
      res.status(200).json(assessment);
    } catch (error: any) {
      res.status(500).json({ message: 'Erro ao buscar avaliação', error: error.message });
    }
  },

  /**
   * Criar uma nova avaliação
   */
  createAssessment: async (req: Request, res: Response) => {
    const { 
      childId, 
      examinerId, 
      caregiverId, 
      assessmentDate,
      responses,
      comments 
    } = req.body;
    
    try {
      // Verificar se a criança existe
      const child = await prisma.child.findUnique({
        where: { id: childId }
      });
      
      if (!child) {
        return res.status(404).json({ message: 'Criança não encontrada' });
      }
      
      // Calcular pontuações brutas
      const scoredResponses = responses.map((r: any) => ({
        itemId: r.itemId,
        response: r.response
      }));
      
      const scores = await scoringService.calculateRawScores(scoredResponses);
      
      // Criar a avaliação com as pontuações calculadas
      const assessment = await prisma.sensoryAssessment.create({
        data: {
          childId,
          examinerId: examinerId || undefined,
          caregiverId: caregiverId || undefined,
          assessmentDate: assessmentDate ? new Date(assessmentDate) : new Date(),
          auditoryProcessingRawScore: scores.sectionScores.auditoryProcessing,
          visualProcessingRawScore: scores.sectionScores.visualProcessing,
          tactileProcessingRawScore: scores.sectionScores.tactileProcessing,
          movementProcessingRawScore: scores.sectionScores.movementProcessing,
          bodyPositionProcessingRawScore: scores.sectionScores.bodyPositionProcessing,
          oralSensitivityRawScore: scores.sectionScores.oralSensitivityProcessing,
          socialEmotionalRawScore: scores.sectionScores.socialEmotionalResponses,
          attentionRawScore: scores.sectionScores.attentionResponses,
          responses: {
            create: responses.map((r: any) => ({
              itemId: r.itemId,
              response: r.response
            }))
          },
          comments: {
            create: comments?.map((c: any) => ({
              sectionName: c.sectionName,
              comments: c.comments
            })) || []
          }
        }
      });
      
      res.status(201).json({
        assessment,
        scores
      });
    } catch (error: any) {
      res.status(500).json({ message: 'Erro ao criar avaliação', error: error.message });
    }
  },

  /**
   * Atualizar uma avaliação existente
   */
  updateAssessment: async (req: Request, res: Response) => {
    const { id } = req.params;
    const { 
      examinerId, 
      caregiverId, 
      assessmentDate,
      responses,
      comments 
    } = req.body;
    
    try {
      // Verificar se a avaliação existe
      const existingAssessment = await prisma.sensoryAssessment.findUnique({
        where: { id: Number(id) }
      });
      
      if (!existingAssessment) {
        return res.status(404).json({ message: 'Avaliação não encontrada' });
      }
      
      // Atualizar respostas se fornecidas
      if (responses && responses.length > 0) {
        // Remover respostas existentes
        await prisma.sensoryResponse.deleteMany({
          where: { assessmentId: Number(id) }
        });
        
        // Adicionar novas respostas
        await Promise.all(
          responses.map((r: any) => 
            prisma.sensoryResponse.create({
              data: {
                assessmentId: Number(id),
                itemId: r.itemId,
                response: r.response
              }
            })
          )
        );
        
        // Recalcular pontuações
        const scoredResponses = responses.map((r: any) => ({
          itemId: r.itemId,
          response: r.response
        }));
        
        const scores = await scoringService.calculateRawScores(scoredResponses);
        
        // Atualizar pontuações na avaliação
        await prisma.sensoryAssessment.update({
          where: { id: Number(id) },
          data: {
            auditoryProcessingRawScore: scores.sectionScores.auditoryProcessing,
            visualProcessingRawScore: scores.sectionScores.visualProcessing,
            tactileProcessingRawScore: scores.sectionScores.tactileProcessing,
            movementProcessingRawScore: scores.sectionScores.movementProcessing,
            bodyPositionProcessingRawScore: scores.sectionScores.bodyPositionProcessing,
            oralSensitivityRawScore: scores.sectionScores.oralSensitivityProcessing,
            socialEmotionalRawScore: scores.sectionScores.socialEmotionalResponses,
            attentionRawScore: scores.sectionScores.attentionResponses
          }
        });
      }
      
      // Atualizar comentários se fornecidos
      if (comments && comments.length > 0) {
        // Remover comentários existentes
        await prisma.sectionComment.deleteMany({
          where: { assessmentId: Number(id) }
        });
        
        // Adicionar novos comentários
        await Promise.all(
          comments.map((c: any) => 
            prisma.sectionComment.create({
              data: {
                assessmentId: Number(id),
                sectionName: c.sectionName,
                comments: c.comments
              }
            })
          )
        );
      }
      
      // Atualizar outros dados da avaliação
      const updatedAssessment = await prisma.sensoryAssessment.update({
        where: { id: Number(id) },
        data: {
          examinerId: examinerId || undefined,
          caregiverId: caregiverId || undefined,
          assessmentDate: assessmentDate ? new Date(assessmentDate) : undefined
        },
        include: {
          child: true,
          examiner: true,
          caregiver: true,
          responses: {
            include: {
              item: true
            }
          },
          comments: true
        }
      });
      
      res.status(200).json(updatedAssessment);
    } catch (error: any) {
      res.status(500).json({ message: 'Erro ao atualizar avaliação', error: error.message });
    }
  },

  /**
   * Excluir uma avaliação
   */
  deleteAssessment: async (req: Request, res: Response) => {
    const { id } = req.params;
    
    try {
      // Verificar se a avaliação existe
      const assessment = await prisma.sensoryAssessment.findUnique({
        where: { id: Number(id) }
      });
      
      if (!assessment) {
        return res.status(404).json({ message: 'Avaliação não encontrada' });
      }
      
      // Excluir a avaliação (as respostas e comentários serão excluídos em cascata)
      await prisma.sensoryAssessment.delete({
        where: { id: Number(id) }
      });
      
      res.status(200).json({ message: 'Avaliação excluída com sucesso' });
    } catch (error: any) {
      res.status(500).json({ message: 'Erro ao excluir avaliação', error: error.message });
    }
  },

  /**
   * Gerar relatório de uma avaliação
   */
  generateReport: async (req: Request, res: Response) => {
    const { id } = req.params;
    
    try {
      const report = await scoringService.generateAssessmentReport(Number(id));
      res.status(200).json(report);
    } catch (error: any) {
      res.status(500).json({ message: 'Erro ao gerar relatório', error: error.message });
    }
  }
};

export default assessmentController;
