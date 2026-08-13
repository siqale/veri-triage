# Especificação Técnica e Conceitual de Arquitetura de IA (Versão 3.0 - Enterprise Edition)

**Data:** Agosto de 2026
**Status:** Implementado & Validado
**Licença:** MIT (para fins educacionais e de demonstração de portfólio)

---

## 1. Objetivo do Sistema
Automatizar a coleta de sintomas, a classificação de risco (Protocolo de Manchester) e a geração de resumos clínicos (SOAP/FHIR), garantindo que **nenhuma informação seja gravada no Prontuário Eletrônico do Paciente (PEP)** sem a validação soberana de um profissional de medicina.

**Princípios norteadores:**
- **Privacy by Design (LGPD):** Separação absoluta entre dados PII (Frontend) e inferência clínica (Backend LLM).
- **Determinismo absoluto:** Qualidade garantida por *QA Harness* matemático, sem *LLM-as-a-judge*.
- **Testabilidade:** Mocks de *Boundary* na camada de roteamento da API e isolamento via containers.
- **Resiliência:** Arquitetura Multi-Cloud (*Factory Pattern*) para evitar aprisionamento tecnológico (Vendor Lock-in).

---

## 2. Stack Tecnológico

| Camada | Ferramenta | Papel na Arquitetura |
| :--- | :--- | :--- |
| **Frontend** | React + Vite + Vitest | Gerencia o RBAC (Triagem vs Recepção vs Médico), oculta PII da IA, e roda testes de *boundary* UI. |
| **Backend API** | FastAPI + Pytest | Gateway de roteamento seguro (mTLS/HTTPS), gestão de threads e mocking *Boundary* para testes. |
| **Orquestrador IA** | LangGraph | Máquina de Estados Finita. Gerencia memória, breakpoints (Human-in-the-Loop) e fluxo linear. |
| **Abstração IA** | LangChain + Pydantic | Força saídas determinísticas (*Structured Outputs*), *RAG* e abstração agnóstica dos provedores. |
| **Infra & DevOps** | Docker + Docker Compose | Garante Sandboxing. A API da IA roda numa sub-rede interna restrita (`veritriage_internal`). |
| **Cloud/LLM** | Azure AI Foundry / OpenAI | Escalabilidade corporativa. Suporte para fallback local (DeepSeek/GPT-3.5) via variáveis de ambiente. |

---

## 3. Mapeamento Detalhado do Fluxo (LangGraph State Machine)

### Nó 0: Guardrail (Segurança em Primeiro Lugar)
- **Função:** É o primeiro ponto de contato da IA. Analisa o texto bruto do paciente.
- **Ação:** Se for detectado qualquer tentativa de *Prompt Injection* (ex: "Ignore as regras..."), o grafo é interrompido antes mesmo da extração clínica, emitindo um erro HTTP 403 e a flag `is_safe=False`.

### Nó 1: Extração Estruturada Pydantic
- **Função:** LLM forçada a operar com *function calling*. 
- **Ação:** Converte texto narrativo bagunçado em um JSON validado pelo Pydantic, garantindo tipos estritos (arrays de sintomas). Máscaras de LGPD nativas garantem anonimato.

### Nó 2: Classificação de Risco (RAG Contextual)
- **Função:** O cérebro clínico da operação.
- **Ação:** O sistema lê a taxonomia de sintomas do Protocolo de Manchester (`manchester_protocol.json`), injeta isso no *System Prompt* (Grounding) dinamicamente, e classifica o paciente com uma das 5 cores universais, acompanhada de justificativa determinística.

### 🛑 Breakpoint: Human-in-the-Loop (Aprovação Médica)
- **Ação:** O Grafo para (`interrupt_before`). O backend aguarda uma requisição HTTP via `/triage/resume/{thread_id}` proveniente do painel do Médico (React). O médico ajusta ou ratifica a cor antes do fluxo continuar.

### Nó 3: Síntese SOAP e Integração
- **Função:** Pós-processamento clínico e FHIR.
- **Ação:** Um nó finaliza o texto no padrão internacional SOAP (Subjetivo, Objetivo, Avaliação, Plano) baseando-se no que foi **aprovado pelo médico**, preparando a saída no formato FHIR para o Prontuário.

---

## 4. Estratégia de Qualidade e Governança

### 4.1. QA Harness (Feedback Determinístico)
Substituímos o viés do "LLM as a Judge" por métricas exatas. 
- Criamos a aba **QA HARNESS** no Frontend.
- Ela consome o endpoint `GET /triage/eval-harness`, injetando dezenas de pacientes de um dataset padronizado e verificando via `Exact Match` se `predicted_risk == expected_risk`. Acurácia matemática acima de achismos.

### 4.2. Testes e Cobertura Pytest (Boundary Mocking)
- Para testes unitários, nós fazemos o *Mock* da instância do Grafo (`triage_graph`) diretamente nas rotas do FastAPI (`tests/test_triage.py`). 
- Isso permite simular cenários complexos (Injection Bloqueado, Retomada Falha 404, Extração Bem Sucedida) garantindo latência zero e custo zero de tokens em pipelines de CI/CD.

### 4.3. Isolamento Multi-Cloud e Sandboxing
- Todo o instanciamento do LLM está abstraído na `Factory` (`src/core/llm.py`), que automaticamente migra de *OpenAI genérica* para *Azure AI Foundry* se houver credenciais corporativas no ambiente.
- O Docker roda sob o profile `api-prod`, não expondo portas host para a API de IA, obrigando o tráfego a trafegar exclusivamente através do gateway (Isolamento de Rede `bridge`).

---

## 5. Roadmap de Conclusão

✅ **[Fase 1]** Refatoração da Máquina de Estados (LangGraph).
✅ **[Fase 2]** RBAC Frontend e Proteção LGPD (React/Vite).
✅ **[Fase 3]** QA Harness Automático & Testes de Integração determinísticos.
✅ **[Fase 4]** Governança Corporativa (Azure Factory, Sandboxing de Redes e `ARCHITECTURE.md`).

> *Documento de especificação atualizado pós-implementação dos requisitos Sênior/Lead Engineer.*