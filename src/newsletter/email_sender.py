from typing import List, Dict, Optional
from mailersend import MailerSendClient, EmailBuilder
import re


class MailerSendEmailSender:
    def __init__(self, api_key: str, from_email: str, from_name: str):
        if not api_key:
            raise ValueError("API key é obrigatória.")

        self.client = MailerSendClient(api_key=api_key)
        self.from_email = from_email
        self.from_name = from_name

    @staticmethod
    def _html_to_text(html: str) -> str:
        text = re.sub(r"<[^>]+>", "", html)
        return text.strip()

    def send(
        self,
        to: List[Dict[str, str]],
        subject: str,
        html_content: str,
        text_content: Optional[str] = None,
    ) -> str:
        if not html_content:
            raise ValueError("html_content não pode ser vazio.")

        if not to:
            raise ValueError("Lista de destinatários não pode estar vazia.")

        text_content = text_content or self._html_to_text(html_content)

        email = (
            EmailBuilder()
            .from_email(self.from_email, self.from_name)
            .to_many(to)
            .subject(subject)
            .html(html_content)
            .text(text_content)
            .build()
        )

        response = self.client.emails.send(email)

        return True