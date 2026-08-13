from langchain_openai import ChatOpenAI, AzureChatOpenAI
import os

def get_llm():
    """
    Retorna a instância do LLM configurada.
    Suporta fallback para Azure OpenAI caso as variáveis de ambiente existam,
    garantindo adequação a ambientes corporativos restritos (Azure AI Foundry).
    """
    if os.environ.get("AZURE_OPENAI_API_KEY") and os.environ.get("AZURE_OPENAI_ENDPOINT"):
        return AzureChatOpenAI(
            azure_deployment=os.environ.get("AZURE_OPENAI_DEPLOYMENT", "gpt-4"),
            openai_api_version=os.environ.get("AZURE_OPENAI_API_VERSION", "2023-05-15"),
            azure_endpoint=os.environ.get("AZURE_OPENAI_ENDPOINT"),
            api_key=os.environ.get("AZURE_OPENAI_API_KEY"),
            temperature=0
        )
    
    # DeepSeek usando a interface da OpenAI (Fallback/Default)
    return ChatOpenAI(
        model="deepseek-chat", 
        temperature=0,
        openai_api_key=os.environ.get("DEEPSEEK_API_KEY", "default-key"),
        openai_api_base="https://api.deepseek.com"
    )

# Instância Singleton
llm = get_llm()
