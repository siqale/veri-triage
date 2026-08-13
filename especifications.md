# Especificação Técnica e Conceitual de Arquitetura de IA (Versão 2.0 - Determinística)

**Autor:** [Seu Nome/GitHub]
**Data:** 13 de Agosto de 2026
**Licença:** MIT (para fins open-source educacionais e de demonstração)

---

## 1. Objetivo do Sistema
Automatizar a coleta de sintomas, a classificação de risco (Protocolo de Manchester) e a geração de resumos clínicos (SOAP), garantindo que **nenhuma informação seja gravada no Prontuário Eletrônico do Paciente (PEP)** sem a validação soberana de um profissional de medicina.

**Princípios norteadores:**
- **Determinismo absoluto:** Em fluxos médicos, o comportamento da IA deve ser previsível e reproduzível.
- **Testabilidade:** Cada etapa deve ser testável unitariamente com entradas e saídas fixas.
- **Rastreabilidade jurídica:** Cada decisão da IA deve ser auditável passo a passo (LGPD/ANS).

---

## 2. Stack Tecnológico (O "Triângulo de Ouro")
| Ferramenta | Papel na Arquitetura | Justificativa |
| :--- | :--- | :--- |
| **LangGraph** | Orquestrador Core (Máquina de Estados) | Gerencia a memória do paciente, os pontos de interrupção (Human-in-the-Loop) e a persistência do fluxo. |
| **LangChain** | Camada de Execução e Abstração | Fornece as cadeias determinísticas (RunnableSequence), as ferramentas de integração HL7/FHIR, os parsers estruturados (Pydantic) e a abstração dos LLMs. |
| **LangSmith** | Camada de Observabilidade e Governança | Rastreia toda a cadeia (traces), latência, custos de token e fornece o log de auditoria para comitês de compliance. |

> **Nota de Revisão (v2.0):** Diferente de abordagens comuns no mercado, **esta arquitetura NÃO utiliza CrewAI ou multiagentes com debate livre**. A experiência clínica exige previsibilidade de custo e tempo; portanto, substituímos o debate não-determinístico por cadeias de processamento lineares e engessadas, com validadores de coerência ao final.

---

## 3. Mapeamento Detalhado do Fluxo (Passo a Passo)

### Nó 0: Entrada e Normalização
- **Entrada:** Texto bruto (digitação da enfermagem), transcrição de áudio do paciente (via Whisper) ou dados do totem de autoatendimento.
- **Ação:** O LangGraph recebe esta entrada e a anexa ao estado global da thread do paciente.

---

### Nó 1: Extração Estruturada e Validação de Entidades (Sub-grafo Determinístico)
*Este nó é uma cadeia linear (RunnableSequence) do LangChain, dividida em 3 passos obrigatórios:*

**Passo 1.1 - Extrator Rígido (LLM T=0):**
- **Mecanismo:** Chamada ao modelo com `temperature=0` e `PydanticOutputParser`.
- **Prompt:** Extraia obrigatoriamente: (a) Sintomas principais, (b) Intensidade da dor (0-10), (c) Histórico de doenças relatadas, (d) Lista de medicamentos de uso contínuo.
- **Saída:** JSON estritamente tipado.

**Passo 1.2 - Ferramenta de Interação Medicamentosa (Código Puro):**
- **Mecanismo:** Chamada a uma `@tool` customizada que consulta o barramento HL7/FHIR do hospital ou uma base de dados local (ex: SQLite com medicamentos).
- **Saída:** Relatório de alertas (ex: "Losartana + Ibuprofeno: risco de nefrotoxicidade").

**Passo 1.3 - Validador de Coerência Factual (O "Filtro de Segurança"):**
- **Mecanismo:** Chamada a um LLM **barato** (ex: GPT-3.5-Turbo) com `temperature=0`.
- **Tarefa:** Comparar o JSON gerado no Passo 1.1 com o **texto bruto original** do Nó 0.
- **Pergunta exata:** *"O JSON contém alguma informação (sintoma ou medicamento) que NÃO foi mencionada no texto original? Responda SIM/NÃO e cite a divergência."*
- **Ação em caso de "SIM":** O LangGraph levanta uma exceção e interrompe o fluxo, notificando a enfermagem para revisão manual do texto. **O paciente não avança para a classificação de risco.**
- **Saída Final do Nó 1:** JSON enriquecido + Flag `validado: true`.

---

### Nó 2: Classificação de Risco (Protocolo de Manchester)
- **Entrada:** JSON validado do Nó 1.
- **Mecanismo (LangChain + Prompt Engenheirado):** LLM com `temperature=0`. O prompt é injetado com as regras oficiais do Protocolo de Manchester (ou protocolo interno do hospital).
- **Restrição:** O output é forçado a ser uma das 5 cores (Vermelho, Laranja, Amarelo, Verde, Azul) acompanhada de uma justificativa clínica obrigatória.
- **Saída:** Classificação de risco atribuída.

---

### 🛑 Ponto de Interrupção Obrigatório (Human-in-the-Loop)
- **Mecanismo (LangGraph):** Utilizamos `interrupt_before=["node_3"]`. O estado completo do paciente (Nó 1 + Nó 2) é persistido em banco de dados.
- **Painel do Médico:** Um evento é disparado para o front-end hospitalar. O médico visualiza a classificação sugerida e as evidências.
- **Ações permitidas:**
  1. **Aprovar:** Prossegue para o Nó 3.
  2. **Alterar Classificação:** O médico modifica a cor manualmente e prossegue.
  3. **Recusar:** O fluxo é cancelado e registra-se o motivo.

---

### Nó 3: Síntese e Geração do Sumário Clínico (Padrão SOAP)
- **Entrada:** Confirmação da aprovação humana + Dados dos Nós 1 e 2.
- **Mecanismo (LangChain):** Chamada a um modelo de contexto longo (ex: Claude 3 Haiku ou Gemini) com um prompt estruturado.
- **Template:** Obrigatoriamente gera o resumo no formato SOAP:
  - *S (Subjetivo):* Relato do paciente.
  - *O (Objetivo):* Sinais e medições extraídas.
  - *A (Avaliação):* Classificação de risco e alertas farmacológicos.
  - *P (Plano):* Sugestão de conduta inicial (campo aberto para o médico ajustar).
- **Saída:** Texto narrativo estruturado.

---

### Nó 4: Persistência e Integração com o PEP (Gravação)
- **Entrada:** Sumário SOAP + Metadados (ID do médico, timestamp da aprovação).
- **Mecanismo (LangChain Tool):** Ferramenta customizada que:
  1. Converte o sumário para o padrão **FHIR R4** (Recurso `Composition`).
  2. Realiza uma requisição **POST** autenticada via **mTLS** para a API do Prontuário Eletrônico.
- **Saída:** Confirmação HTTP 201 (Created). O grafo é encerrado e a thread do paciente é finalizada.

---

## 4. Requisitos de Governança, Segurança e Auditoria (LangSmith)
Para cada execução, o LangSmith coleta e retém permanentemente:

1. **Rastreabilidade Total (Traceability):** O prompt exato e a resposta bruta de **cada um dos 3 passos** do Nó 1, e também do Nó 2.
2. **Assinatura de Validação:** Registro do `timestamp` e do `ID do médico` que executou a liberação no breakpoint.
3. **Monitoramento de Alucinação (Pós-execução):** Um avaliador automático no LangSmith compara o sumário do Nó 3 com a entrada do Nó 0, emitindo um score de "Factualidade" para alertar a equipe de ML sobre possíveis derivações.

---

## 5. Por que optamos por uma abordagem puramente determinística (Sem CrewAI)?

| Aspecto | Abordagem Multiagente (CrewAI) | Abordagem Determinística (LangChain + LangGraph) |
| :--- | :--- | :--- |
| **Previsibilidade** | Baixa (o debate pode seguir caminhos distintos) | Alta (fluxo linear e engessado) |
| **Custo por requisição** | Variável e imprevisível (loops de discussão) | Fixo e calculado (ex: 3 chamadas LLM por paciente) |
| **Testes Unitários** | Complexo (mocking de interações entre agentes) | Simples (cada passo é uma função isolada) |
| **Auditoria Jurídica** | Difícil de explicar (dezenas de mensagens internas) | Cristalina (3 passos claros e rastreáveis) |
| **Tempo de Resposta** | Lento (segundos a dezenas de segundos) | Rápido (média de 2-4 segundos totais) |

A remoção do CrewAI não reduziu a segurança; pelo contrário, forçamos a criação de um **Validador de Coerência (Passo 1.3)** que atua como um "segundo par de olhos" estático, garantindo que a IA não invente dados.

---

## 6. Instruções para Execução Open-Source

Para rodar este projeto em ambiente de desenvolvimento, você precisará:

1. Definir variáveis de ambiente:
   ```env
   OPENAI_API_KEY=sk-...
   LANGCHAIN_API_KEY=ls_...
   LANGCHAIN_PROJECT=projeto-triagem-clinica
   FHIR_API_URL=https://sandbox.hospital.com/fhir
   MTLS_CERT_PATH=./certs/client.crt


## 7. Desenvolvimento e Padrões (SDD)

### 7.1. Comandos de Desenvolvimento
- **Instalação:** `pip install -r requirements.txt` (ou `poetry install`)
- **Dev Server:** `uvicorn src.api.main:app --reload`
- **Executar Testes:** `pytest tests/ --cov=src`
- **Lint e Formatação:** `ruff check . --fix && ruff format .`

### 7.2. Estrutura do Projeto
```text
src/
├── api/             → Endpoints REST (FastAPI) e rotas webhooks
├── core/            → Configurações (settings), prompts base e estado do grafo (State)
├── nodes/           → Implementação dos nós individuais do LangGraph (entrada, extrator, classificador, etc.)
├── tools/           → Ferramentas customizadas (integração HL7/FHIR, checagem de interações)
├── models/          → Schemas Pydantic (validação de entrada/saída)
└── main.py          → Ponto de entrada e orquestração do grafo
tests/               → Testes unitários (mocks LLM) e de integração
docs/                → ADRs e documentação técnica
```

### 7.3. Code Style e Convenções
- **Type Hints Obrigatórios:** Todo código Python deve ser tipado.
- **Pydantic Everywhere:** Toda entrada de LLM e saída deve ser parseada e validada via Pydantic.
- **Exemplo de Nó (LangGraph):**
```python
from typing import Dict, Any
from core.state import PatientState

def node_risk_classification(state: PatientState) -> Dict[str, Any]:
    """Classifica o risco do paciente usando os dados extraídos."""
    validated_data = state.get("extracted_data")
    if not validated_data or not state.get("is_valid"):
        raise ValueError("Dados não validados recebidos no nó de classificação.")
    
    # Lógica do LLM aqui...
    return {"risk_classification": "Laranja", "justification": "..."}
```

### 7.4. Estratégia de Testes
- **Framework:** `pytest`.
- **Testes Unitários (~80%):** Mockar as chamadas de LLM para testar apenas a transição de estado do grafo e a lógica de validação.
- **Testes de Integração (~20%):** Avaliações no LangSmith (evals) com datasets sintéticos de pacientes para garantir que a taxonomia do Protocolo de Manchester não sofra alucinações.

### 7.5. Boundaries (Limites de Segurança)
- **Always do (Sempre faça):** Usar `temperature=0` para processos de extração estruturada e classificação; validar todos os payloads com Pydantic antes de avançar o estado; manter o Human-in-the-Loop configurado.
- **Ask first (Pergunte antes):** Mudar os prompts "core" de classificação clínica; adicionar novas dependências externas pesadas; alterar o endpoint do PEP (Prontuário).
- **Never do (Nunca faça):** Salvar dados sensíveis do paciente em logs de erro; fazer chamadas assíncronas ao banco de dados que burlem o state do LangGraph; remover o Validador de Coerência (Passo 1.3).

---

## 8. Roadmap

✅ Definição da arquitetura conceitual.

⏳ Implementação dos Nós 1 a 4 em Python puro (usando LangGraph + LangChain).

⏳ Criação de testes unitários com dados sintéticos (pacientes fictícios).

⏳ Criação de um avaliador de desempenho no LangSmith (métrica de acurácia da classificação de risco).

⏳ Documentação da API REST para integração com o front-end hospitalar.

Observação: Este projeto é uma prova de conceito (PoC) para fins educacionais e de demonstração de engenharia de IA. Para uso em produção real, consulte a equipe jurídica e de compliance do hospital para validação dos prompts e regras de negócio.