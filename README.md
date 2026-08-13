# VeriTriage AI 🏥🤖

Um sistema avançado de triagem clínica *Role-Based* (RBAC) impulsionado por Inteligência Artificial Generativa e orquestração de agentes. Construído sob rigorosos padrões de engenharia de software (Spec-Driven Development), governança corporativa e em conformidade com o Privacy by Design (LGPD).

Este projeto não é um "chatbot médico", mas sim um sistema *Enterprise-Grade* projetado para integrar IA com fluxos operacionais humanos de forma segura, determinística e escalável.

---

## 🎯 Arquitetura e Principais Tecnologias

- **Backend (API & Orquestração):** Python, FastAPI, LangGraph, LangChain.
- **Frontend (UI & Fluxo de Usuários):** React, TypeScript, Vite.
- **LLM/Cloud Suporte:** Multi-Cloud Factory Pattern (OpenAI, DeepSeek, Azure AI Foundry).
- **Isolamento e Deploy:** Docker, Docker Compose (Sandboxing de Redes Isoladas).
- **Testes e Qualidade:** Pytest (API Boundary Mocking), QA Harness Evaluation (Exact Match Determinístico).

## 🛡️ Destaques de Engenharia e Governança

### 1. Spec-Driven Development e QA Harness
A qualidade das respostas da IA não depende de avaliação humana ou viés ("LLM as a judge"). 
- Todos os fluxos de saída são validados por esquemas restritos Pydantic (`with_structured_output`).
- Possui um painel interno de **QA Harness**, onde um dataset local clínico (`harness_dataset.json`) é submetido ao pipeline. A métrica de sucesso é avaliada matematicamente através da intersecção entre o "Risco Previsto" e o "Risco Esperado".

### 2. Segurança e LGPD (Privacy by Design)
- **Nó de Guardrail (Prompt Injection):** Antes de qualquer inferência de negócios, o texto passa por um classificador rígido de segurança. Tentativas de vazamento de dados ou injeção de prompt pausam a execução e emitem HTTP 403.
- **Separação de PII:** Dados pessoais identificáveis (Nome, CPF, Convênio) são inseridos apenas na camada de Recepção (Frontend React State). A LLM no backend recebe exclusivamente sintomas clínicos anônimos e um UUID, garantindo que o provedor de IA nunca intercepte dados cruzados reais de pacientes.

### 3. Pipeline RAG Integrado
O classificador injeta de forma contextual o Protocolo de Manchester na *System Prompt* baseando-se em mapeamento de sintomas (RAG), garantindo o ancoramento clínico (*Grounding*) e mitigando alucinações de risco.

### 4. Human-in-the-Loop (RBAC)
O fluxo da aplicação possui separação de papéis:
1. **Triagem (Enfermeiro):** Input clínico sem PII.
2. **Recepção (Balcão):** Coleta e união com PII no state local.
3. **Médico (Decisão):** Avaliação humana do risco sugerido pela IA. O Médico aprova ou rejeita a classificação gerando o documento final (SOAP).

---

## 🚀 Como Rodar o Projeto (Ambiente Local)

### Pré-requisitos
- Docker e Docker Compose instalados.
- Node.js e NPM (para rodar o frontend localmente no modo de desenvolvimento).

### Configuração Inicial
1. Clone este repositório.
2. Crie um arquivo `.env` na raiz, baseando-se no `.env.example`:
   ```bash
   cp .env.example .env
   ```
3. Preencha as chaves de API (seja `DEEPSEEK_API_KEY` ou a infraestrutura completa do `AZURE_OPENAI`).

### Executando o Backend (API) via Docker
O ambiente de dev inicia a API na porta `8000` com hot-reload (SQLite mapeado em volume local).
```bash
docker compose --profile dev up --build
```

### Executando o Frontend
Em um novo terminal, abra a pasta `frontend` e rode a UI em React.
```bash
cd frontend
npm install
npm run dev
```
Acesse `http://localhost:5173` no navegador.

### 🚢 Governança e Deploy (CI/CD)

**Arquitetura Multi-Cloud (Evitando Vendor Lock-in)**
Todo o roteamento de LLMs foi unificado utilizando o padrão *Factory* (`src/core/llm.py`), permitindo que a aplicação transite transparentemente entre Azure AI Foundry (padrão corporativo) ou instâncias locais/OpenAI, dependendo unicamente de variáveis de ambiente.

**Versionamento Semântico Automatizado**
Visando esteiras de CI/CD limpas, o projeto adota o padrão **Conventional Commits** pareado com o `release-it`. Em vez de editar as versões manualmente, a governança ocorre com 1 clique:
```bash
npm run release
```
Iso analisa os commits (feat, fix), faz o *bump* dinâmico das tags no Git, atualiza as strings de versão do Python (FastAPI) e do Node (React) simultaneamente e autogera o arquivo `CHANGELOG.md` sem intervenção humana.

---

### ✅ Executando a Suíte de Testes (QA & Security)
A garantia de qualidade no VeriTriage não é baseada em *olhômetro*. Nós validamos as barreiras de injeção de prompt e o mascaramento LGPD de forma puramente determinística utilizando Pytest em containers isolados.

**Testes de Backend / IA (Pytest):**
```bash
docker compose --profile dev run --rm -v ./tests:/app/tests -e PYTHONPATH=/app api-dev pytest tests/ -v
```
*Resultado Esperado:* 100% de Passing Rate (`test_prompt_injection_blocked`, `test_pii_masking_and_successful_triage`, entre outros).

**Testes de Frontend / UI Boundaries (Vitest):**
O frontend também possui testes focados em provar a arquitetura *Privacy by Design*. Eles validam, através da renderização de componentes, que campos de PII (como CPF) nunca são renderizados na camada da Triagem Clínica.
```bash
cd frontend
npx vitest run
```
*Resultado Esperado:* 100% de Passing Rate nos testes de *LGPD boundaries* e renderização do fluxo RBAC.

---

## 📚 Documentação Adicional
Consulte o arquivo oficial de [Arquitetura e Governança de IA (ARCHITECTURE.md)](ARCHITECTURE.md) presente neste repositório para diagramas da topologia, limites de rede (Sandboxing do Docker) e critérios de aceitação automatizados exigidos neste pipeline.

---

*Projeto construído para demonstrar arquitetura, liderança técnica, segurança e integração de LLMs corporativos no setor de saúde.*
