import os
import requests
from typing import Optional


class MailgunEmailSender:
    """
    Cliente simples para envio de emails HTML via Mailgun (sandbox ou domínio verificado).
    """

    def __init__(
        self,
        domain: str,
        api_key: Optional[str] = None,
        base_url: str = "https://api.mailgun.net/v3",
    ):
        self.domain = domain
        self.api_key = api_key or os.getenv("MAILGUN_API_KEY")
        self.base_url = f"{base_url}/{self.domain}/messages"

        if not self.api_key:
            raise RuntimeError("MAILGUN_API_KEY não configurada no ambiente.")

    def send_html_email(
        self,
        to_address: str,
        subject: str,
        html_content: str,
        from_address: Optional[str] = None,
        text_fallback: Optional[str] = None,
    ) -> bool:
        """
        Envia email com conteúdo HTML.
        """

        from_address = from_address or f"Test <postmaster@{self.domain}>"

        payload = {
            "from": from_address,
            "to": to_address,
            "subject": subject,
            "html": html_content,
        }

        # fallback texto simples (recomendado)
        if text_fallback:
            payload["text"] = text_fallback

        response = requests.post(
            self.base_url,
            auth=("api", self.api_key),
            data=payload,
            timeout=10,
        )

        response.raise_for_status()
        return response.ok