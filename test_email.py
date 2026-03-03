from src.load.email_sender import MailgunEmailSender

sender = MailgunEmailSender(
    domain="sandboxXXXX.mailgun.org"
)

html_body = """
<html>
    <body>
        <h1>Teste HTML</h1>
        <p>Este é um <strong>email de teste</strong> via Mailgun Sandbox.</p>
    </body>
</html>
"""

sender.send_html_email(
    to_address="seuemail@gmail.com",
    subject="Teste HTML Mailgun",
    html_content=html_body,
    text_fallback="Teste HTML Mailgun",
)