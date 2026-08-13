from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import uuid
import os
import json
from src.models.schemas import TriageInput, TriageResume, TriageResponseStart, TriageResponseFinish
from src.main import triage_graph # Importando o nosso orquestrador compilado

app = FastAPI(
    title="Very Triage API",
    description="API para triagem clínica determinística usando LangGraph e FastAPI.",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/triage/start", response_model=TriageResponseStart, status_code=202)
async def start_triage(payload: TriageInput):
    """Inicia o fluxo de triagem no LangGraph."""
    
    # Gera um thread_id único para rastrear este paciente no MemorySaver
    thread_id = str(uuid.uuid4())
    config = {"configurable": {"thread_id": thread_id}}
    
    # Estado inicial
    initial_state = {"patient_text": payload.patient_text}
    
    # Roda o grafo até bater no breakpoint (interrupt_before="summarizer") ou terminar (se inválido)
    for event in triage_graph.stream(initial_state, config):
        pass # Apenas consome o stream até a pausa
        
    # Recupera o estado parado no checkpoint
    current_state = triage_graph.get_state(config)
    
    # Checa se falhou na segurança (Guardrail)
    if not current_state.values.get("is_safe", True):
        raise HTTPException(
            status_code=403, 
            detail=f"Violação de Segurança: {current_state.values.get('security_violation_reason')}"
        )
        
    # Checa se falhou no validador
    if not current_state.values.get("is_valid", True):
        raise HTTPException(
            status_code=400, 
            detail=f"Falha de Validação: {current_state.values.get('validation_error')}"
        )
        
    response = TriageResponseStart(
        thread_id=thread_id,
        status="WAITING_HUMAN_APPROVAL" if current_state.next else "ENDED",
        extracted_data=current_state.values.get("extracted_data"),
        suggested_risk=current_state.values.get("suggested_risk"),
        justification=current_state.values.get("justification")
    )
    return response


@app.post("/triage/resume/{thread_id}", response_model=TriageResponseFinish)
async def resume_triage(thread_id: str, payload: TriageResume):
    """Retoma o fluxo do LangGraph (Nó 3 e 4) injetando a decisão do médico."""
    
    config = {"configurable": {"thread_id": thread_id}}
    current_state = triage_graph.get_state(config)
    
    # Se não há 'next', significa que o grafo já terminou ou não existe
    if not current_state.next:
        raise HTTPException(status_code=404, detail="Triagem não encontrada ou já finalizada.")
        
    # Injeta os dados da aprovação médica diretamente no state (update)
    triage_graph.update_state(
        config,
        {
            "approved_risk": payload.approved_risk,
            "doctor_id": payload.doctor_id,
            "observations": payload.observations
        }
    )
    
    # Retoma a execução do grafo (passando None ele continua de onde parou)
    for event in triage_graph.stream(None, config):
        pass
        
    final_state = triage_graph.get_state(config)
    
    return TriageResponseFinish(
        thread_id=thread_id,
        status="COMPLETED",
        soap_summary=final_state.values.get("soap_summary", "Erro ao gerar resumo"),
        fhir_status=final_state.values.get("fhir_status", "Erro de integração")
    )

@app.get("/triage/eval-harness")
async def evaluate_harness():
    """
    Roda a avaliação determinística baseada no dataset (QA Harness).
    """
    dataset_path = "data/harness_dataset.json"
    if not os.path.exists(dataset_path):
        raise HTTPException(status_code=404, detail="Dataset de avaliação não encontrado.")
        
    with open(dataset_path, "r", encoding="utf-8") as f:
        dataset = json.load(f)
        
    results = []
    total = len(dataset)
    passed = 0
    
    for case in dataset:
        thread_id = f"eval_{case['id']}"
        config = {"configurable": {"thread_id": thread_id}}
        
        predicted_risk = "Error"
        
        # Invocamos o Grafo
        final_state = triage_graph.invoke({"patient_text": case["input_text"]}, config)
        
        if not final_state.get("is_safe", True):
            predicted_risk = "Rejected_By_Guardrail"
        else:
            predicted_risk = final_state.get("suggested_risk", "Unknown")
            
        # Avaliação Determinística (Exact Match)
        is_correct = (predicted_risk == case["expected_risk"])
        if is_correct:
            passed += 1
            
        results.append({
            "case_id": case["id"],
            "description": case["description"],
            "expected_risk": case["expected_risk"],
            "predicted_risk": predicted_risk,
            "passed": is_correct
        })
        
    accuracy = (passed / total) * 100 if total > 0 else 0
    
    return {
        "metrics": {
            "total_cases": total,
            "passed": passed,
            "failed": total - passed,
            "accuracy_percent": accuracy
        },
        "results": results
    }
