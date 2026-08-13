from langgraph.graph import StateGraph, END
import sqlite3
import os

# Tenta importar da nova ou antiga estrutura do pacote (compatibilidade)
try:
    from langgraph.checkpoint.sqlite import SqliteSaver
except ImportError:
    from langgraph_checkpoint_sqlite import SqliteSaver

from src.core.state import PatientState
from src.nodes.extractor import node_extractor
from src.nodes.classifier import node_classifier
from src.nodes.summarizer import node_summarizer
from src.nodes.fhir_pusher import node_fhir_pusher
from src.nodes.guardrail import node_guardrail

# Garante que a pasta 'data' existe para o banco
os.makedirs("data", exist_ok=True)

# Conexão SQLite (check_same_thread=False é crucial pro FastAPI usar em múltiplas requisições assíncronas)
conn = sqlite3.connect("data/checkpoints.sqlite", check_same_thread=False)
memory = SqliteSaver(conn)
memory.setup() # Cria as tabelas necessárias no SQLite automaticamente

# Função de roteamento condicional (Validador de Coerência)
def check_validation(state: PatientState) -> str:
    """Se a extração for inválida, encerra o grafo precocemente."""
    if not state.get("is_valid", False):
        return "invalid"
    return "valid"

# Função de roteamento condicional (Guardrail de Segurança)
def check_security(state: PatientState) -> str:
    """Se houver injeção de prompt, encerra o grafo."""
    if not state.get("is_safe", True):
        return "unsafe"
    return "safe"

# Construindo o Grafo
builder = StateGraph(PatientState)

# Adicionando os nós
builder.add_node("guardrail", node_guardrail)
builder.add_node("extractor", node_extractor)
builder.add_node("classifier", node_classifier)
builder.add_node("summarizer", node_summarizer)
builder.add_node("fhir_pusher", node_fhir_pusher)

# Definindo o Fluxo (Arestas)
builder.set_entry_point("guardrail")

# Aresta condicional após Guardrail
builder.add_conditional_edges(
    "guardrail",
    check_security,
    {
        "safe": "extractor",
        "unsafe": END # Encerra sem processar se for malicioso
    }
)

# Aresta condicional após extração
builder.add_conditional_edges(
    "extractor",
    check_validation,
    {
        "valid": "classifier",
        "invalid": END # Encerra sem classificar se dados forem inválidos
    }
)

# Do classificador vai para o summarizer (mas com interrupção no meio configurada abaixo)
builder.add_edge("classifier", "summarizer")
builder.add_edge("summarizer", "fhir_pusher")
builder.add_edge("fhir_pusher", END)

# Compilando o Grafo com o breakpoint antes de rodar o 'summarizer'
# Isso significa que, após classificar, o grafo irá pausar esperando o /resume
triage_graph = builder.compile(
    checkpointer=memory,
    interrupt_before=["summarizer"] # O Human-in-the-loop acontece aqui
)
