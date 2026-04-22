export interface AnamneseChild {
  name: string;
  birthDate: string;
  gender?: string;
  nationalIdentity?: string;
  otherInfo?: string;
  age?: number | null;
}

export interface AnamneseCaregiver {
  name: string;
  relationship: string;
  contact?: string;
}

export interface ClinicalHistoryQueixa {
  mainComplaint: string;
  complaintOnset: string;
  previousTreatments: string;
}

export interface ClinicalHistoryGestation {
  plannedPregnancy: string;
  deliveryType: string;
  prenatalCareDetails: string;
  complications: string;
  medicationsDuringPregnancy: string;
  gestationalAgeWeeks?: number | null;
  birthWeightGrams?: number | null;
  birthLengthCm?: number | null;
  apgar1min?: number | null;
  apgar5min?: number | null;
  neonatalIntercurrences: string;
}

export interface ClinicalHistoryDevelopment {
  heldHeadMonths?: number | null;
  sattMonths?: number | null;
  crawledMonths?: number | null;
  walkedMonths?: number | null;
  firstWordsMonths?: number | null;
  firstSentencesMonths?: number | null;
  sphincterControlMonths?: number | null;
  currentMotorObservations: string;
  currentLanguageObservations: string;
}

export interface ClinicalHistoryHealth {
  allergies: string;
  chronicConditions: string;
  currentMedications: string;
  pastSurgeries: string;
  hospitalizations: string;
  recurrentIllnesses: string;
  sleepPattern: string;
  feedingPattern: string;
}

export interface ClinicalHistorySchool {
  attendsSchool: string;
  shift: string;
  schoolName: string;
  grade: string;
  academicPerformance: string;
  socialBehaviorAtSchool: string;
  hasSupportTeacher: string;
  supportDetails: string;
}

export interface ClinicalHistoryFamily {
  livesWith: string;
  parentsMaritalStatus: string;
  siblings: string;
  familyHistoryOfDisorders: string;
  socioeconomicNotes: string;
  additionalNotes: string;
}

export interface AnamneseClinicalHistory {
  queixa: ClinicalHistoryQueixa;
  gestation: ClinicalHistoryGestation;
  development: ClinicalHistoryDevelopment;
  health: ClinicalHistoryHealth;
  school: ClinicalHistorySchool;
  family: ClinicalHistoryFamily;
}

export interface AnamneseProps {
  id: string;
  userId: string;
  child: AnamneseChild;
  caregiver: AnamneseCaregiver;
  clinicalHistory: AnamneseClinicalHistory;
  shareToken: string | null;
  sharedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AnamneseSummary {
  id: string;
  childName: string;
  caregiverName: string;
  createdAt: Date;
  updatedAt: Date;
  shareToken: string | null;
}

export class Anamnese {
  readonly id: string;
  readonly userId: string;
  child: AnamneseChild;
  caregiver: AnamneseCaregiver;
  clinicalHistory: AnamneseClinicalHistory;
  shareToken: string | null;
  sharedAt: Date | null;
  readonly createdAt: Date;
  updatedAt: Date;

  constructor(props: AnamneseProps) {
    this.id = props.id;
    this.userId = props.userId;
    this.child = props.child;
    this.caregiver = props.caregiver;
    this.clinicalHistory = props.clinicalHistory;
    this.shareToken = props.shareToken;
    this.sharedAt = props.sharedAt;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  toJSON() {
    return {
      id: this.id,
      child: this.child,
      caregiver: this.caregiver,
      clinicalHistory: this.clinicalHistory,
      shareToken: this.shareToken,
      sharedAt: this.sharedAt,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
