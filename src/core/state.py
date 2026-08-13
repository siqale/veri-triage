from typing import TypedDict, Optional, List, Dict, Any
from src.models.schemas import ExtractedData

class PatientState(TypedDict):
    # Entradas originais
    patient_text: str
    
    # Passo 0: Guardrails (Segurança e LGPD)
    is_safe: bool
    security_violation_reason: Optional[str]
    
    # Passo 1: Extração
    extracted_data: Optional[ExtractedData]
    is_valid: bool # Flag do Validator de Coerência
    validation_error: Optional[str]
    drug_interaction_alert: Optional[str] # Mockado por hoje
    
    # Passo 2: Classificação (Manchester)
    suggested_risk: Optional[str]
    justification: Optional[str]
    
    # Passo 3: Aprovação Humana (Human-in-the-loop)
    approved_risk: Optional[str]
    doctor_id: Optional[str]
    observations: Optional[str]
    
    # Passo 4: Finalização
    soap_summary: Optional[str]
    fhir_status: Optional[str]
