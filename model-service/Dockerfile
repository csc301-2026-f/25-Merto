FROM python:3.12-slim
WORKDIR /app
ENV PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
RUN python verify_weights.py
EXPOSE 8080
CMD ["python", "run_local.py", "--host", "0.0.0.0", "--port", "8080"]
