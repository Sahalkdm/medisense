import { Schema, Type } from "@google/genai";

export const MODEL_NAME = 'gemini-3-pro-preview';

export const SYSTEM_INSTRUCTION = `
You are **HealthScan Assistant v2**, a highly advanced AI health information tool. Your goal is to provide safe, educational, non-diagnostic assessments based on multimodal inputs (images + symptoms).

### CORE RESPONSIBILITIES
1.  **Multimodal Analysis**: Combine visual evidence (bounding boxes, patterns) with user text/audio to form a coherent picture.
2.  **Safety First**: Determine the urgency ("low", "medium", "urgent") accurately.
3.  **Dual-Mode Explanation**: 
    *   *Simple Mode*: Empathic, clear, actionable advice for a layperson.
    *   *Expert Mode*: Scientific reasoning, medical terminology, and differential analysis (educational only).
4.  **Lifestyle Inference**: Infer how factors like stress, sleep, or diet might be relevant based on the condition type (e.g., skin issues often relate to stress/diet).

### SAFETY PROTOCOLS (STRICT)
*   **NO DIAGNOSIS**: Never say "You have X". Say "Findings are consistent with X" or "This pattern is often seen in X".
*   **NO PRESCRIPTIONS**: Only suggest OTC options or general care (ice, rest, hygiene).
*   **URGENT TRIGGERS**: Any sign of anaphylaxis, deep wounds, severe burns, spreading infection, or chest pain must be labeled **"urgent"**.

### OUTPUT INSTRUCTIONS
*   **Image Regions**: specific areas of interest as [ymin, xmin, ymax, xmax] coordinates (0-1 scale) if applicable.
*   **Doctor Report**: A formal, objective summary suitable for showing a professional.
*   **Lists**: Distinct "Do" and "Avoid" lists for clarity.

Return strictly JSON matching the schema.
`;

export const RESPONSE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    risk_level: {
      type: Type.STRING,
      enum: ["low", "medium", "urgent"],
      description: "Safety risk assessment."
    },
    risk_reasoning: {
      type: Type.STRING,
      description: "Brief explanation of why this risk level was assigned."
    },
    visual_confidence_score: {
      type: Type.NUMBER,
      description: "Confidence in the visual clarity and finding identification (0.0 to 1.0)."
    },
    symptom_severity: {
      type: Type.STRING,
      enum: ["mild", "moderate", "severe"]
    },
    visual_findings_summary: {
      type: Type.STRING,
      description: "Detailed description of visible physical signs."
    },
    image_regions: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          area: { type: Type.STRING, description: "Name of the area (e.g. 'Left forearm lesion')." },
          bbox: { type: Type.ARRAY, items: { type: Type.NUMBER } },
          finding: { type: Type.STRING, description: "What is seen in this box." }
        }
      }
    },
    symptom_summary: {
      type: Type.STRING,
      description: "Summary of user-reported symptoms."
    },
    possible_factors: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "3-5 potential non-diagnostic causes."
    },
    recommended_actions: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "General recommended steps."
    },
    urgent_signs_to_watch: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "Early warning signs that would require immediate care."
    },
    do_list: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "Specific positive actions (e.g., 'Keep dry', 'Elevate')."
    },
    avoid_list: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "Specific actions to avoid (e.g., 'Scratching', 'Hot water')."
    },
    doctor_questions: {
      type: Type.ARRAY,
      items: { type: Type.STRING }
    },
    followup_recommendation: {
      type: Type.STRING,
      description: "Suggestion on when to re-assess (e.g., 'Check again in 24 hours')."
    },
    doctor_report: {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING },
        visual_description: { type: Type.STRING },
        symptom_notes: { type: Type.STRING },
        risk_level: { type: Type.STRING },
        suggested_questions: { type: Type.ARRAY, items: { type: Type.STRING } }
      }
    },
    estimated_lifestyle_factors: {
      type: Type.OBJECT,
      properties: {
        stress: { type: Type.STRING },
        sleep_quality: { type: Type.STRING },
        diet_impact: { type: Type.STRING }
      }
    },
    deep_reasoning: {
      type: Type.STRING,
      description: "Complex scientific reasoning and differential analysis (Expert Mode)."
    },
    user_friendly_summary: {
      type: Type.STRING,
      description: "Simple, empathic summary for the user (Simple Mode)."
    },
    disclaimer: {
      type: Type.STRING
    }
  },
  required: [
    "risk_level", "risk_reasoning", "visual_confidence_score", "symptom_severity",
    "visual_findings_summary", "symptom_summary", "possible_factors",
    "do_list", "avoid_list", "urgent_signs_to_watch",
    "deep_reasoning", "user_friendly_summary", "doctor_report", "disclaimer"
  ],
};