from langchain_core.prompts import PromptTemplate
from src.core.llm import llm
from src.core.state import PatientState
from src.models.schemas import ExtractedData
import os

# Prompt do Sistema para Extração (Passo 1.1)
extraction_prompt = PromptTemplate.from_template(
    """Você é um assistente clínico de extração de dados estruturados.
Extraia as informações solicitadas a partir do relato do paciente abaixo.

Relato do Paciente:
{patient_text}

Instruções:
- Liste apenas sintomas e fatos médicos explícitos.
- Se a dor não for mencionada em número, retorne null.
"""
)

# Chain global
chain = extraction_prompt | llm.with_structured_output(ExtractedData, method="function_calling")

def node_extractor(state: PatientState) -> dict:
    """
    Nó 1 do LangGraph: Extração e Validação.
    1. Executa o LLM para estruturar os dados.
    2. Checa interações medicamentosas (MOCK).
    3. Roda o validador de coerência.
    """
    
    # 1.1 Extração com LLM (chamando invoke e forçando a saída Pydantic)
    extracted: ExtractedData = chain.invoke({"patient_text": state["patient_text"]})
    
    # 1.2 Checagem de Interação Medicamentosa (MOCK)
    drug_alert = None
    if extracted.current_medications and "losartana" in [m.lower() for m in extracted.current_medications]:
        drug_alert = "Alerta: O paciente usa Losartana (anti-hipertensivo)."
        
    # 1.3 Validador de Coerência (Regra de Negócio Pura)
    is_valid = True
    validation_error = None
    if not extracted.symptoms:
        is_valid = False
        validation_error = "Nenhum sintoma foi extraído do texto. A triagem não pode prosseguir."
        
    # Retorna o dicionário com as chaves que devem ser atualizadas no PatientState
    return {
        "extracted_data": extracted,
        "is_valid": is_valid,
        "validation_error": validation_error,
        "drug_interaction_alert": drug_alert
    }
