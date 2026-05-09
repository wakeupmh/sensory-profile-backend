-- Initial schema for Perfil Sensorial 2
-- Run this first, then 001_add_indexes.sql

CREATE TABLE IF NOT EXISTS children (
  id UUID PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  birth_date DATE,
  gender VARCHAR(50),
  national_identity VARCHAR(255),
  user_id VARCHAR(255) NOT NULL,
  other_info TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS examiners (
  id UUID PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  profession VARCHAR(255) NOT NULL,
  contact VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS caregivers (
  id UUID PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  relationship VARCHAR(255) NOT NULL,
  contact VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sensory_assessments (
  id UUID PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  child_id UUID NOT NULL REFERENCES children(id),
  examiner_id UUID REFERENCES examiners(id),
  caregiver_id UUID REFERENCES caregivers(id),
  assessment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  auditory_processing_raw_score NUMERIC,
  visual_processing_raw_score NUMERIC,
  tactile_processing_raw_score NUMERIC,
  movement_processing_raw_score NUMERIC,
  body_position_processing_raw_score NUMERIC,
  oral_sensitivity_processing_raw_score NUMERIC,
  behavioral_responses_raw_score NUMERIC,
  social_emotional_responses_raw_score NUMERIC,
  attention_responses_raw_score NUMERIC,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sensory_responses (
  id UUID PRIMARY KEY,
  assessment_id UUID NOT NULL REFERENCES sensory_assessments(id) ON DELETE CASCADE,
  item_id VARCHAR(255) NOT NULL,
  response VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS section_comments (
  id UUID PRIMARY KEY,
  assessment_id UUID NOT NULL REFERENCES sensory_assessments(id) ON DELETE CASCADE,
  section_name VARCHAR(255) NOT NULL,
  comments TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
