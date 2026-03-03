from src.extractors.fgv_extractor import FgvExtractor
from src.newsletter.renderer import HtmlRenderer
from src.newsletter.email_sender import MailerSendEmailSender
from src.config.settings import settings

extractor = FgvExtractor()
html = extractor.fetch()
items = extractor._parse(html)
print(items)


renderer = HtmlRenderer(template_path="src/newsletter/templates")
html_rendered = renderer.render_from_file("fgv_templates.html", items)
# renderer.save(html_rendered, "preview.html")


sender = MailerSendEmailSender(
    api_key=settings.MAILERSEND_API_KEY,
    from_email=f"test@{settings.MAILERSEND_DOMAIN}",
    from_name="FGV Newsletter"
)

message_id = sender.send(
    to=[
        {
            "email": settings.MAILERSEND_RECIPIENT,
            "name": "Rafaella"
        }
    ],
    subject="FGV Newsletter",
    html_content=html_rendered
)

print(f"Email enviado")