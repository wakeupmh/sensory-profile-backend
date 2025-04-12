import { Router } from 'express';
import { AssessmentController } from '../controllers/AssessmentController';
import { AssessmentService } from '../../../application/services/AssessmentService';
import { PgAssessmentRepository } from '../../../infrastructure/repositories/PgAssessmentRepository';
import { PgResponseRepository } from '../../../infrastructure/repositories/PgResponseRepository';
import { ChildService } from '../../../application/services/ChildService';
import { ExaminerService } from '../../../application/services/ExaminerService';
import { CaregiverService } from '../../../application/services/CaregiverService';
import { SectionCommentService } from '../../../application/services/SectionCommentService';
import { requireAuth } from '@clerk/express';
import { Request, Response } from 'express';
import { getAuth } from '@clerk/express';

const assessmentRepository = new PgAssessmentRepository();
const responseRepository = new PgResponseRepository();
const childService = new ChildService();
const examinerService = new ExaminerService();
const caregiverService = new CaregiverService();
const sectionCommentService = new SectionCommentService();

const assessmentService = new AssessmentService(
  assessmentRepository, 
  responseRepository,
  childService,
  examinerService,
  caregiverService,
  sectionCommentService
);

const assessmentController = new AssessmentController(assessmentService);

const router = Router();

router.use(requireAuth());

// Child routes
router.get('/children', async (req: Request, res: Response) => {
  try {
    const { userId } = getAuth(req);
    
    if (!userId) {
      res.status(401).json({ message: 'Usuário não autenticado' });
      return;
    }
    
    const children = await childService.getAllChildren(userId);
    res.status(200).json(children);
  } catch (error: any) {
    res.status(500).json({ 
      message: 'Erro ao buscar crianças', 
      error: error.message 
    });
  }
});

router.get('/children/:id', async (req: Request, res: Response) => {
  try {
    const { userId } = getAuth(req);
    
    if (!userId) {
      res.status(401).json({ message: 'Usuário não autenticado' });
      return;
    }
    
    const child = await childService.getChildById(req.params.id, userId);
    
    if (!child) {
      res.status(404).json({ message: 'Criança não encontrada' });
      return;
    }
    
    res.status(200).json(child);
  } catch (error: any) {
    res.status(500).json({ 
      message: 'Erro ao buscar criança', 
      error: error.message 
    });
  }
});

// Examiner routes
router.get('/examiners', async (req: Request, res: Response) => {
  try {
    const { userId } = getAuth(req);
    
    if (!userId) {
      res.status(401).json({ message: 'Usuário não autenticado' });
      return;
    }
    
    const examiners = await examinerService.getAllExaminers();
    res.status(200).json(examiners);
  } catch (error: any) {
    res.status(500).json({ 
      message: 'Erro ao buscar examinadores', 
      error: error.message 
    });
  }
});

router.get('/examiners/:id', async (req: Request, res: Response) => {
  try {
    const { userId } = getAuth(req);
    
    if (!userId) {
      res.status(401).json({ message: 'Usuário não autenticado' });
      return;
    }
    
    const examiner = await examinerService.getExaminerById(req.params.id);
    
    if (!examiner) {
      res.status(404).json({ message: 'Examinador não encontrado' });
      return;
    }
    
    res.status(200).json(examiner);
  } catch (error: any) {
    res.status(500).json({ 
      message: 'Erro ao buscar examinador', 
      error: error.message 
    });
  }
});

// Caregiver routes
router.get('/caregivers', async (req: Request, res: Response) => {
  try {
    const { userId } = getAuth(req);
    
    if (!userId) {
      res.status(401).json({ message: 'Usuário não autenticado' });
      return;
    }
    
    const caregivers = await caregiverService.getAllCaregivers();
    res.status(200).json(caregivers);
  } catch (error: any) {
    res.status(500).json({ 
      message: 'Erro ao buscar cuidadores', 
      error: error.message 
    });
  }
});

router.get('/caregivers/:id', async (req: Request, res: Response) => {
  try {
    const { userId } = getAuth(req);
    
    if (!userId) {
      res.status(401).json({ message: 'Usuário não autenticado' });
      return;
    }
    
    const caregiver = await caregiverService.getCaregiverById(req.params.id);
    
    if (!caregiver) {
      res.status(404).json({ message: 'Cuidador não encontrado' });
      return;
    }
    
    res.status(200).json(caregiver);
  } catch (error: any) {
    res.status(500).json({ 
      message: 'Erro ao buscar cuidador', 
      error: error.message 
    });
  }
});

// Assessment specific routes
router.get('/:id/report', assessmentController.generateReport.bind(assessmentController));

// Assessment general routes
router.get('/', assessmentController.getAllAssessments.bind(assessmentController));
router.get('/:id', assessmentController.getAssessmentById.bind(assessmentController));
router.post('/', assessmentController.createAssessment.bind(assessmentController));
router.put('/:id', assessmentController.updateAssessment.bind(assessmentController));
router.delete('/:id', assessmentController.deleteAssessment.bind(assessmentController));

export default router;
