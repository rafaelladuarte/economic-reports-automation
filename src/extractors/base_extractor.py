import abc
import logging
import ssl
import requests

from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
from urllib3.poolmanager import PoolManager


logger = logging.getLogger(__name__)


class TLSHttpAdapter(HTTPAdapter):
    """
    Adapter HTTP que força:
    - TLS >= 1.2
    - Cipher suites fortes
    """

    def init_poolmanager(self, connections, maxsize, block=False, **pool_kwargs):
        ssl_context = ssl.create_default_context()

        # Força TLS moderno
        ssl_context.minimum_version = ssl.TLSVersion.TLSv1_2

        # Define cipher suite segura
        ssl_context.set_ciphers("HIGH:!aNULL:!eNULL:!MD5:!RC4")

        pool_kwargs["ssl_context"] = ssl_context

        return super().init_poolmanager(
            connections,
            maxsize,
            block=block,
            **pool_kwargs,
        )


class BaseExtractor(abc.ABC):
    """
    Classe base responsável por:

    - Configurar sessão HTTP robusta
    - Garantir negociação TLS moderna
    - Executar requisição GET
    - Retornar HTML bruto

    Parsing deve ser implementado pelas subclasses.
    """

    def __init__(self, base_url: str):
        self.base_url = base_url
        self.user_agent = (
            "Mozilla/5.0 (X11; Linux x86_64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/122.0.0.0 Safari/537.36"
        )
        self.session = self._build_session()

    def _build_session(self) -> requests.Session:
        """
        Cria sessão HTTP com:
        - Retry automático
        - TLS moderno
        """

        session = requests.Session()

        retry_strategy = Retry(
            total=3,
            backoff_factor=1,
            status_forcelist=[429, 500, 502, 503, 504],
            allowed_methods=["GET"],
            raise_on_status=False,
        )

        adapter = TLSHttpAdapter(max_retries=retry_strategy)

        session.mount("https://", adapter)
        session.mount("http://", adapter)

        return session

    def fetch(self) -> str:
        """
        Executa requisição HTTP GET e retorna o HTML bruto.
        Lança exceções se falhar.
        """

        headers = {
            "User-Agent": self.user_agent,
            "Accept": (
                "text/html,application/xhtml+xml,"
                "application/xml;q=0.9,image/avif,image/webp,"
                "*/*;q=0.8"
            ),
            "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
            "Connection": "keep-alive",
        }

        logger.info(f"Realizando requisição para {self.base_url}")

        response = self.session.get(
            self.base_url,
            headers=headers,
            timeout=20,
        )

        response.raise_for_status()

        logger.info(
            f"Requisição concluída com status {response.status_code}"
        )

        return response.text