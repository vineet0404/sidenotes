FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY server.py llm.py rag.py ./
COPY static ./static
ENV PORT=8000 TRUST_PROXY=1
EXPOSE 8000
# ONE worker on purpose: sessions are kept in this process's memory.
CMD ["sh", "-c", "uvicorn server:app --host 0.0.0.0 --port ${PORT} --workers 1"]
