from src.extractors.fgv_extractor import FgvExtractor
from src.newsletter.renderer import HtmlRenderer

extractor = FgvExtractor()
html = extractor.fetch()
items = extractor._parse(html)
print(items)


renderer = HtmlRenderer(template_path="src/newsletter/templates")
html_rendered = renderer.render_from_file("fgv_templates.html", items)
renderer.save(html_rendered, "preview.html")

