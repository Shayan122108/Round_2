FROM python:3.11.9-slim

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1 \
    OMP_NUM_THREADS=1 OPENBLAS_NUM_THREADS=1 MKL_NUM_THREADS=1
COPY requirements.txt /tmp/requirements.txt
RUN pip install -r /tmp/requirements.txt && rm /tmp/requirements.txt

WORKDIR /app
COPY runner.py challenge_features.py /app/
RUN chmod 0444 /app/*.py
ENV PYTHONPATH=/app

# Non-root, no shell login, nothing else in the image. Run with:
#   --network none --read-only --cap-drop ALL --security-opt no-new-privileges
#   --pids-limit N --memory M --cpus C --tmpfs /tmp  -v in:/in:ro -v out:/out
USER 65534:65534
ENTRYPOINT ["python", "/app/runner.py"]

