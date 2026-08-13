from langchain_core.prompts import PromptTemplate
from src.core.llm import llm
from src.core.state import PatientState
import os

summarizer_prompt = PromptTemplate.from_template(
    """Você é um médico redigindo um resumo no formato SOAP (Subjetivo, Objetivo, Avaliação, Plano).
O médico já aprovou a classificação de risco.

Relato original do paciente: {patient_text}
Sintomas Extraídos: {symptoms}
Risco Aprovado pelo Médico: {approved_risk}
Observações do Médico: {observations}

Redija um breve resumo SOAP.
"""
)

def node_summarizer(state: PatientState) -> dict:
    """
    Nó 3 do LangGraph: Gera o resumo SOAP após aprovação do médico.
    Este nó roda SOMENTE após o Human-in-the-loop.
    """
    # Proteção
    if not state.get("approved_risk"):
        raise ValueError("Cannot summarize without human approved risk.")
        
    data = state["extracted_data"]
    
    chain = summarizer_prompt | llm
    
    # Invocação simples retornando string (texto do SOAP)
    result = chain.invoke({
        "patient_text": state["patient_text"],
        "symptoms": ", ".join(data.symptoms) if data else "Nenhum",
        "approved_risk": state["approved_risk"],
        "observations": state.get("observations") or "Nenhuma"
    })
    
    return {
        "soap_summary": result.content
    }
