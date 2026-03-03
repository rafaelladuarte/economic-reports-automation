# src/render/html_renderer.py

from pathlib import Path
from typing import Dict, Union
from jinja2 import Environment, FileSystemLoader, Template


class HtmlRenderer:
    def __init__(self, template_path: Union[str, Path, None] = None):
        self.template_path = Path(template_path) if template_path else None

        if self.template_path:
            self.env = Environment(
                loader=FileSystemLoader(self.template_path),
                autoescape=True
            )
        else:
            self.env = Environment(autoescape=True)

    def render_from_file(self, template_name: str, context: Dict) -> str:
        if not self.template_path:
            raise ValueError("Template path não foi definido.")

        template = self.env.get_template(template_name)
        return template.render(**context)

    def render_from_string(self, template_str: str, context: Dict) -> str:
        template: Template = self.env.from_string(template_str)
        return template.render(**context)

    @staticmethod
    def save(html: str, output_path: Union[str, Path]) -> None:
        output_path = Path(output_path)
        output_path.write_text(html, encoding="utf-8")