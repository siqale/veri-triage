# Stage 1: Build dependencies
FROM python:3.11-slim AS builder

WORKDIR /app

# Instalar dependências de sistema necessárias para compilação (se houver)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copiar apenas os requirements primeiro para aproveitar o cache do Docker
COPY requirements.txt .
RUN pip wheel --no-cache-dir --no-deps --wheel-dir /app/wheels -r requirements.txt


# Stage 2: Final runtime image
FROM python:3.11-slim

# Evita que o Python grave arquivos .pyc e força o log direto no terminal (imutabilidade e observabilidade)
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

# Criar um usuário não-root por segurança (best practice)
RUN adduser --disabled-password --gecos "" appuser && chown -R appuser /app

# Copiar as dependências compiladas do builder e instalá-las
COPY --from=builder /app/wheels /wheels
COPY --from=builder /app/requirements.txt .
RUN pip install --no-cache /wheels/*

# Copiar o código fonte do projeto
COPY ./src ./src

# Alterar para o usuário não-root
USER appuser

# Expor a porta que o FastAPI vai rodar
EXPOSE 8000

# Comando imutável de inicialização
CMD ["uvicorn", "src.api.main:app", "--host", "0.0.0.0", "--port", "8000"]
