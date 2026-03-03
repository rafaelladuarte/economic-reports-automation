# ============================================================
# Dockerfile — Economic Reports Automation (Airflow 2.9.3)
# ============================================================
#
# Baseado na imagem oficial do Apache Airflow com Python 3.12.
# Instala dependências adicionais do projeto via requirements.txt
# e configura PYTHONPATH para que 'src.*' seja importável
# tanto no scheduler, no webserver quanto nas próprias DAGs.
# ============================================================

FROM apache/airflow:2.9.3-python3.12

# Copia o requirements.txt antes de qualquer COPY para aproveitar
# o cache de camadas do Docker quando as dependências não mudam.
COPY requirements.txt /requirements.txt

# Instala dependências como usuário airflow (sem sudo/root).
# O pip já está disponível na imagem base.
RUN pip install --no-cache-dir -r /requirements.txt

# Copia o código-fonte do projeto para /opt/airflow/src
# O Airflow trabalha com /opt/airflow como WORKDIR padrão.
COPY src/ /opt/airflow/src/

# Copia as DAGs para o diretório esperado pelo Airflow
COPY dags/ /opt/airflow/dags/

# Garante que /opt/airflow esteja no PYTHONPATH
# para que 'from src.extractors.fgv_extractor import ...' funcione.
ENV PYTHONPATH=/opt/airflow
