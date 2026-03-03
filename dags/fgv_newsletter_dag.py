from datetime import datetime
from airflow import DAG
from airflow.sdk import task

from src.extractors.fgv_extractor import FgvExtractor
from src.newsletter.renderer import HtmlRenderer
from src.newsletter.email_sender import MailerSendEmailSender
from src.config.settings import settings


default_args = {
    "owner": "rafaella",
    "retries": 1,
}


with DAG(
    dag_id="fgv_newsletter_pipeline",
    start_date=datetime(2024, 1, 1),
    schedule="@weekly",
    catchup=False,
    default_args=default_args,
    tags=["newsletter", "fgv"],
) as dag:

    @task
    def extract():
        extractor = FgvExtractor()
        raw_html = extractor.fetch()
        items = extractor._parse(raw_html)
        return items

    @task
    def render(items: dict):
        renderer = HtmlRenderer(template_path="src/newsletter/templates")
        html_rendered = renderer.render_from_file("fgv_templates.html", items)

        file_path = "/tmp/preview.html"
        renderer.save(html_rendered, file_path)

        return file_path

    @task
    def send_email(file_path: str):
        sender = MailerSendEmailSender(
            api_key=settings.MAILERSEND_API_KEY,
            from_email=f"test@{settings.MAILERSEND_DOMAIN}",
            from_name="FGV Newsletter",
        )

        with open(file_path, "r", encoding="utf-8") as f:
            html_content = f.read()

        sender.send(
            to=[{"email": settings.MAILERSEND_RECIPIENT, "name": "Rafaella"}],
            subject="FGV Newsletter",
            html_content=html_content,
        )

    items = extract()
    rendered_file = render(items)
    send_email(rendered_file)