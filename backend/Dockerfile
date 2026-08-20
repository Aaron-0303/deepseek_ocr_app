# Backend Dockerfile - FastAPI + DeepSeek-OCR
FROM nvcr.io/nvidia/pytorch:25.09-py3

ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_INDEX_URL=https://pypi.tuna.tsinghua.edu.cn/simple \
    HF_HOME=/models

WORKDIR /app

# Install dependencies from the Tsinghua PyPI mirror
COPY requirements.txt .
RUN python -m pip install --upgrade pip && \
    python -m pip install -r requirements.txt

# Copy backend code
COPY *.py .

EXPOSE 30380

# Use uvicorn with reasonable workers for GPU workload
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "30380", "--workers", "1"]
