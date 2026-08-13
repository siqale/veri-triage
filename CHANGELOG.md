# Changelog

## 0.0.1 (2026-08-13)

(VeriTriage AI)

Todas as alterações notáveis deste projeto serão documentadas neste arquivo. 
O formato é baseado no [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/).

## [1.0.0] - 2026-08-13
**Status Final:** Lançamento da *Enterprise Edition* para Portfólio.

### Adicionado (Security & DevOps)
- **API Gateway:** Adicionado `Traefik` no `docker-compose.yml` atuando como Proxy Reverso para a API, escondendo portas físicas do host e operando com base em *labels* dinâmicas.
- **Defense in Depth:** Adicionado CORS restrito dinâmico e exigência de cabeçalho HTTP (`X-API-Key`) no FastAPI, condicionado pela variável `ENVIRONMENT=prod`.
- **Sandboxing:** Isolamento de rede (`veritriage_internal`) garantindo que instâncias do LLM nunca tenham tráfego direto com a internet sem passar pelas camadas de defesa.
- **Multi-Cloud Factory:** Criada a abstração `src/core/llm.py` permitindo chaveamento transparente entre Azure AI Foundry (Prod) e provedores locais/abertos (Dev), prevenindo Vendor Lock-in.

### Adicionado (Quality Assurance)
- **QA Harness UI:** Aba interativa no React (`App.tsx`) que executa avaliação determinística em lote.
- **Pytest Boundary Mocking:** Implementação de suíte de testes (`tests/test_triage.py`) que mocka o `triage_graph` na camada de rota, validando transições HTTP, Guardrails e restrições de API Key (Retorno `401 Unauthorized`).
- **Vitest LGPD Boundaries:** Adicionados testes automatizados no frontend (`App.test.tsx`) que comprovam a não-renderização de dados PII (Nome, CPF) nas áreas visíveis para a IA.

### Adicionado (Core IA & Backend)
- **LangGraph Stateful Triage:** Orquestrador baseado em grafos (Máquina de Estados) para controle previsível do fluxo médico.
- **Human-in-the-Loop:** Ponto de interrupção (`interrupt_before`) permitindo que o médico edite e aprove o risco antes da síntese SOAP final.
- **Guardrail Node:** Mecanismo contra *Prompt Injection*, que avalia segurança e paralisa o grafo emitindo HTTP 403.
- **Spec-Driven Development:** Validação estrita de entidades clínicas utilizando `Pydantic` e *Function Calling*.
- **Local RAG Grounding:** Injeção do arquivo `manchester_protocol.json` no prompt do sistema para balizar decisões clínicas.

### Adicionado (Frontend)
- **Role-Based Access Control (RBAC):** Painel web construído em Vite + React simulando fluxo real de hospital (Aba Triagem -> Aba Recepção -> Aba Médico).
- **Privacy by Design:** Dados de identificação (CPF/Nome) são isolados e gerenciados 100% no cliente, garantindo compliance com a LGPD e HIPAA.

### Documentação
- `README.md` estruturado para apresentação de portfólio.
- `ARCHITECTURE.md` com topologia visual via MermaidJS.
- `especifications.md` com as regras de negócio clínicas e arquiteturais.
- `interview_script.md` com o roteiro de perguntas e respostas para entrevistas de Engenheiro/Tech Lead.
