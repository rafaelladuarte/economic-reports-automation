FROM apache/airflow:3.1.7-python3.12

USER root

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        ca-certificates \
        openssl \
        curl && \
    update-ca-certificates && \
    rm -rf /var/lib/apt/lists/*

USER airflow

COPY requirements.txt /requirements.txt
RUN pip install --no-cache-dir -r /requirements.txt

COPY src/ /opt/airflow/src/
COPY dags/ /opt/airflow/dags/

ENV PYTHONPATH=/opt/airflow