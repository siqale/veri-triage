# Plano de Implementação: Backend Very Triage

O objetivo é entregar a infraestrutura de API e o motor de IA (LangGraph) para o sistema de triagem clínica determinística, focado em subir o projeto hoje para testes via cURL.

## User Review Required

> [!IMPORTANT]  
> Como o prazo é curto (entrega hoje), estou propondo "mockar" (simular) duas dependências externas para não travar o desenvolvimento:
> 1. A ferramenta de **Interação Medicamentosa** (Nó 1.2) retornará um alerta estático.
> 2. O envio para o **PEP via FHIR** (Nó 4) fará apenas um print e retornará HTTP 201.
> Podemos plugar as APIs reais futuramente. Você concorda com esse escopo reduzido para garantir a entrega de hoje?

## Open Questions

> [!WARNING]
> **LLM Provider:** Para escrever o código, precisaremos usar um provedor de LLM no LangChain (ex: OpenAI `ChatOpenAI`, Anthropic `ChatAnthropic`, ou Google `ChatVertexAI`). Qual provedor e modelo você planeja usar na sua máquina para testar hoje? (Vou usar a OpenAI como padrão no código se você não especificar, mas me avise para eu ajustar os imports).

## Proposed Changes

O desenvolvimento será fatiado verticalmente (seguindo a skill de *incremental-implementation*), garantindo que tenhamos uma API rodando no primeiro passo.

---

### Slice 1: Fundação e API Base
Configuração inicial, schemas e o esqueleto da API REST (sem o grafo real ainda).

#### [NEW] `requirements.txt`
Dependências base: `fastapi`, `uvicorn`, `langchain`, `langgraph`, `pydantic`, `langchain-openai`.

#### [NEW] `src/api/main.py`
Endpoints FastAPI iniciais (`/triage/start` e `/triage/resume`) com respostas vazias/mockadas.

#### [NEW] `src/models/schemas.py`
Modelos Pydantic baseados na especificação:
- `TriageInput` (texto do paciente)
- `ExtractedData` (sintomas, dor, histórico, medicamentos)
- `TriageResume` (payload de continuação do médico)

---

### Slice 2: Estado e Nós 1 e 2 (Extração e Risco)
Criação do state do LangGraph e a lógica de processamento até a pausa.

#### [NEW] `src/core/state.py`
Definição do `TypedDict` para o estado da thread do paciente (texto original, dados extraídos, cor do risco, validação).

#### [NEW] `src/nodes/extractor.py`
Implementação do Nó 1: LLM com `temperature=0` + Validator de Coerência.

#### [NEW] `src/nodes/classifier.py`
Implementação do Nó 2: Prompt do protocolo de Manchester retornando a cor e a justificativa.

---

### Slice 3: Nós 3 e 4 (SOAP e Integração) e Orquestração
Geração do resumo clínico e montagem final do grafo com breakpoint.

#### [NEW] `src/nodes/summarizer.py`
Implementação do Nó 3: Geração do formato SOAP baseado nos dados aprovados.

#### [NEW] `src/nodes/fhir_pusher.py`
Implementação do Nó 4: Mock do envio FHIR mTLS.

#### [NEW] `src/main.py`
Montagem do `StateGraph` do LangGraph, conectando todos os nós e configurando o `interrupt_before=["summarizer"]`. Conexão final com as rotas do `src/api/main.py`.

---

## Verification Plan

### Testes Manuais (cURL)

**1. Iniciar Triagem:**
```bash
curl -X POST http://localhost:8000/triage/start \
  -H "Content-Type: application/json" \
  -d '{"patient_text": "Paciente de 45 anos relata dor no peito irradiando para o braço esquerdo há 30 minutos. Usa losartana."}'
```
*Deve retornar a extração (Nó 1), a classificação Laranja/Vermelha (Nó 2) e o status `WAITING_HUMAN_APPROVAL`.*

**2. Retomar Triagem (Simulando o Médico):**
```bash
curl -X POST http://localhost:8000/triage/resume/12345 \
  -H "Content-Type: application/json" \
  -d '{"approved_risk": "Vermelho", "doctor_id": "CRM-1234"}'
```
*Deve rodar o Nó 3 (SOAP), o Nó 4 (Mock FHIR) e retornar o sumário final.*
