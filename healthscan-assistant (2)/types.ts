export type RiskLevel = 'low' | 'medium' | 'urgent';
export type SymptomSeverity = 'mild' | 'moderate' | 'severe';

export interface ImageRegion {
  area: string;
  bbox: number[]; // [ymin, xmin, ymax, xmax]
  finding: string;
}

export interface DoctorReport {
  title: string;
  visual_description: string;
  symptom_notes: string;
  risk_level: string;
  suggested_questions: string[];
}

export interface LifestyleFactors {
  stress: string;
  sleep_quality: string;
  diet_impact: string;
}

export interface HealthAssessment {
  risk_level: RiskLevel;
  risk_reasoning: string;
  visual_confidence_score: number;
  symptom_severity: SymptomSeverity;
  
  visual_findings_summary: string;
  image_regions: ImageRegion[];
  
  symptom_summary: string;
  possible_factors: string[];
  recommended_actions: string[];
  urgent_signs_to_watch: string[];
  
  do_list: string[];
  avoid_list: string[];
  
  doctor_questions: string[];
  followup_recommendation: string;
  
  doctor_report: DoctorReport;
  estimated_lifestyle_factors: LifestyleFactors;
  
  deep_reasoning: string;
  user_friendly_summary: string;
  disclaimer: string;
  
  // Legacy support or chat support fields
  suggested_followup_questions?: string[];
}

export interface AnalysisState {
  isLoading: boolean;
  error: string | null;
  result: HealthAssessment | null;
}

export interface MediaFile {
  file: File;
  preview: string;
  base64: string;
  mimeType: string;
  type: 'image' | 'video' | 'pdf';
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

export interface Place {
  name: string;
  latitude: number;
  longitude: number;
  address: string;
  rating: string;
  reason: string;
}

export interface MapSearchResult {
  places: Place[];
  searchCenter?: { lat: number; lng: number };
}