from src.core.state import PatientState

def node_fhir_pusher(state: PatientState) -> dict:
    """
    Nó 4 do LangGraph: Integração com PEP (FHIR).
    No ambiente real, aqui usariamos mTLS para empurrar o state final pro sistema hospitalar.
    No MVP, fazemos um mock de sucesso.
    """
    
    if not state.get("soap_summary"):
        raise ValueError("Cannot push to FHIR without SOAP summary.")
        
    print(f"[FHIR MOCK] Pushing data for Doctor {state['doctor_id']} - Risk: {state['approved_risk']}")
    print(f"[FHIR MOCK] SOAP Payload:\n{state['soap_summary']}")
    
    return {
        "fhir_status": "201 Created (Mock)"
    }
