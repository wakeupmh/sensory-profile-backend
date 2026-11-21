import { AssessmentController } from '../controllers/AssessmentController';
import { AssessmentService } from '../../../application/services/AssessmentService';
import { PgAssessmentRepository } from '../../../infrastructure/repositories/PgAssessmentRepository';
import { PgResponseRepository } from '../../../infrastructure/repositories/PgResponseRepository';
import { ChildService } from '../../../application/services/ChildService';
import { ExaminerService } from '../../../application/services/ExaminerService';
import { CaregiverService } from '../../../application/services/CaregiverService';
import { SectionCommentService } from '../../../application/services/SectionCommentService';
import { domainRouter } from './domainRouter';
import { ResourceShareService } from '../../../application/services/ResourceShareService';
import { PgAssessmentShareRepository } from '../../../infrastructure/repositories/PgResourceShareRepository';
import { ResourceShareController } from '../controllers/ResourceShareController';
import { AssessmentNotFoundError } from '../../../infrastructure/utils/errors/CustomErrors';
import { professionalRepository } from './professionalRoutes';

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

const assessmentShareRepository = new PgAssessmentShareRepository();
const assessmentShareService = new ResourceShareService(
  assessmentShareRepository,
  professionalRepository,
  {
    resourceLabel: 'assessment',
    async assertOwned(resourceId, ownerUserId) {
      const owned = await assessmentRepository.findById(resourceId, ownerUserId);
      if (!owned) throw new AssessmentNotFoundError(resourceId);
    },
  }
);
const assessmentShareController = new ResourceShareController(
  assessmentShareService,
  'assessment',
  'id'
);

export { assessmentRepository, responseRepository, assessmentShareService };

const router = domainRouter();

// Assessment specific routes
router.get('/:id/report', assessmentController.generateReport.bind(assessmentController));

// Assessment general routes
router.get('/', assessmentController.getAllAssessments.bind(assessmentController));
router.get('/:id', assessmentController.getAssessmentById.bind(assessmentController));
router.post('/', assessmentController.createAssessment.bind(assessmentController));
router.put('/:id', assessmentController.updateAssessment.bind(assessmentController));
router.delete('/:id', assessmentController.deleteAssessment.bind(assessmentController));

// Per-professional share grants
router.get('/:id/shares', assessmentShareController.list.bind(assessmentShareController));
router.post('/:id/shares', assessmentShareController.grant.bind(assessmentShareController));
router.delete(
  '/:id/shares/:professionalId',
  assessmentShareController.revoke.bind(assessmentShareController)
);

export default router;
