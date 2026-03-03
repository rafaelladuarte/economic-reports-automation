import abc
import logging
import requests
from requests.adapters import HTTPAdapter
from requests.packages.urllib3.util.retry import Retry


logger = logging.getLogger(__name__)


class BaseExtractor(abc.ABC):
    """
    Classe base responsável exclusivamente por:
    - Configurar sessão HTTP robusta
    - Executar requisição GET
    - Retornar o HTML bruto

    A responsabilidade de parsing, filtragem e normalização
    deve ser implementada pelas classes filhas.
    """

    def __init__(self, base_url: str):
        self.base_url = base_url
        self.session = self._build_session()

        self.user_agent = (
            "Mozilla/5.0 (X11; Linux x86_64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/143.0.0.0 Safari/537.36"
        )

    def _build_session(self) -> requests.Session:
        """
        Cria sessão HTTP com retry automático para falhas transitórias.
        """
        session = requests.Session()

        retry_strategy = Retry(
            total=3,
            backoff_factor=1,
            status_forcelist=[429, 500, 502, 503, 504],
            allowed_methods=["GET"],
        )

        adapter = HTTPAdapter(max_retries=retry_strategy)

        session.mount("http://", adapter)
        session.mount("https://", adapter)

        return session

    def fetch(self) -> str:
        """
        Executa requisição HTTP GET e retorna o HTML bruto.
        Lança exceções caso falhe (não silencia erro).
        """

        headers = {
            "User-Agent": self.user_agent,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
        }

        logger.info(f"Realizando requisição para {self.base_url}")

        response = self.session.get(
            self.base_url,
            headers=headers,
            timeout=15,
        )

        response.raise_for_status()

        logger.info(
            f"Requisição concluída com status {response.status_code}"
        )

        return response.text