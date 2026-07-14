# demand-service — pinned to Python 3.11 (LightGBM/pandas wheels; spec §4.3).
FROM python:3.11-slim

# libgomp is required by LightGBM at runtime.
RUN apt-get update && apt-get install -y --no-install-recommends libgomp1 \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY demand-service/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY demand-service/app ./app

EXPOSE 8084
# Shell form so $PORT (injected by Render/hosts) is honored; defaults to 8084 locally.
CMD uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8084}
