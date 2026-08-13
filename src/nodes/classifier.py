from langchain_core.prompts import PromptTemplate
from src.core.llm import llm
from src.core.state import PatientState
from pydantic import BaseModel, Field
import os
import json

# Schema de saída do classificador
class ClassificationOutput(BaseModel):
    suggested_risk: str = Field(..., description="Cor do risco: Vermelho, Laranja, Amarelo, Verde, ou Azul.")
    justification: str = Field(..., description="Justificativa técnica baseada no Protocolo de Manchester.")

classification_prompt = PromptTemplate.from_template(
    """Você é um enfermeiro de triagem utilizando o Protocolo de Manchester.
Classifique o risco do paciente com base nos dados extraídos abaixo.

Diretrizes Recuperadas do Protocolo (Base de Conhecimento):
{guidelines}

Dados Extraídos:
Sintomas: {symptoms}
Dor: {pain_level}
Histórico: {history}
Medicações: {medications}
Alertas: {drug_alert}

Cores do Protocolo:
- Vermelho: Emergência (ex: parada cardíaca, choque)
- Laranja: Muito Urgente (ex: dor torácica severa, dor > 7)
- Amarelo: Urgente (ex: dor moderada)
- Verde: Pouco Urgente
- Azul: Não Urgente

Classifique e justifique utilizando as Diretrizes Recuperadas se aplicável.
"""
)

def retrieve_guidelines(symptoms: list[str]) -> str:
    """
    Simula uma etapa de Retrieval (RAG) buscando no JSON as categorias
    que mais se assemelham aos sintomas do paciente.
    Em um cenário de produção (Lead AI Eng), isso seria substituído por
    uma Vector Store (ex: Qdrant, Chroma) + Embeddings.
    """
    try:
        with open("data/manchester_protocol.json", "r", encoding="utf-8") as f:
            protocol = json.load(f)
    except Exception:
        return "Nenhuma diretriz encontrada."
    
    symptom_text = " ".join(symptoms).lower()
    words = set(symptom_text.split())
    stop_words = {"de", "com", "sem", "a", "o", "no", "na", "e", "para", "por", "dos", "das"}
    words = words - stop_words
    
    relevant = []
    for entry in protocol:
        entry_symptoms_text = " ".join(entry["symptoms"]).lower()
        entry_words = set(entry_symptoms_text.split()) - stop_words
        
        # Se houver qualquer palavra em comum (match simples)
        if words.intersection(entry_words):
            relevant.append(entry)
            
    if not relevant:
        return "Nenhuma diretriz específica retornada pelo RAG. Aplique o conhecimento geral do protocolo."
        
    context = ""
    for r in relevant:
        context += f"- Categoria: {r['category']} (Risco: {r['risk']})\n  Sintomas chave: {', '.join(r['symptoms'])}\n  Diretriz: {r['guideline']}\n\n"
        
    return context.strip()


def node_classifier(state: PatientState) -> dict:
    """
    Nó 2 do LangGraph: Classificação de Risco (Manchester).
    Este nó é protegido pela regra do boundary: não é executado se os dados falharem no validador (is_valid == False).
    Agora aprimorado com RAG (Retrieval-Augmented Generation).
    """
    
    # Proteção de Boundary (nunca deve chegar aqui se is_valid for false, mas adicionamos fail-safe)
    if not state.get("is_valid") or state.get("extracted_data") is None:
        raise ValueError("Dados não validados chegaram no nó de classificação.")
    
    data = state["extracted_data"]
    
    # Executa o Retrieval
    guidelines = retrieve_guidelines(data.symptoms)
    
    chain = classification_prompt | llm.with_structured_output(ClassificationOutput, method="function_calling")
    
    result: ClassificationOutput = chain.invoke({
        "guidelines": guidelines,
        "symptoms": ", ".join(data.symptoms),
        "pain_level": data.pain_level if data.pain_level is not None else "Não informado",
        "history": ", ".join(data.medical_history),
        "medications": ", ".join(data.current_medications),
        "drug_alert": state.get("drug_interaction_alert") or "Sem alertas"
    })
    
    # Retorna os campos para atualizar o state
    return {
        "suggested_risk": result.suggested_risk,
        "justification": result.justification
    }
