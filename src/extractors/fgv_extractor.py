import sys
import os
import re
import logging
from typing import List, Dict
from datetime import date
from bs4 import BeautifulSoup
from src.extractors.base_extractor import BaseExtractor
from urllib.parse import urljoin, urlparse

logger = logging.getLogger(__name__)

class FgvExtractor(BaseExtractor):

    def __init__(self):
        super().__init__("https://portalibre.fgv.br/revista-conjuntura-economica")
        self.source_name = "FGV"
        self.today = date.today()
        raw_cookies = '_gcl_au=1.1.1927393907.1762952821; _hjSessionUser_5310947=eyJpZCI6ImM0ZmFjNmY3LTAwMWYtNTVjNS04NGMxLWQ1ZmRjMGMxODE1NyIsImNyZWF0ZWQiOjE3NjI5NTI4MjA4MTksImV4aXN0aW5nIjp0cnVlfQ==; _gid=GA1.2.932457876.1767030411; _ga_NFDKH7ZWK7=GS2.1.s1767030410$o6$g0$t1767030410$j60$l0$h0; _ga=GA1.1.814569633.1762952821; _hjSession_5310947=eyJpZCI6IjQ5MTMyYmI5LWNiOTAtNDFiOC1hYTJhLWExNDY4YjczZDEyOSIsImMiOjE3NjcwMzA0MTA5NTgsInMiOjAsInIiOjAsInNiIjowLCJzciI6MCwic2UiOjAsImZzIjowLCJzcCI6MH0=; _ga_D09E8P2WEF=GS2.2.s1767030411$o6$g0$t1767030411$j60$l0$h0; fgv_lgpd_agreement=ok'
        self.cookies = dict(item.split("=", 1) for item in raw_cookies.split("; ") if "=" in item)


    def _absolutizar(self,url: str, base: str = "https://portalibre.fgv.br") -> str:
        if not url:
            return None

        parsed = urlparse(url)

        if parsed.scheme and parsed.netloc:
            return url

        return urljoin(base, url)

    def _parse(self, html: str) -> List[Dict]:
        soup = BeautifulSoup(html, "html.parser")
        
        resultado = {
            "tituloEdicao": None,
            "sumario": {
                "cartaDoIbre": None,
                "pontoDeVista": None,
                "entrevista": None,
                "capa": None,
                "artigos": []
            },
            "cartaIbre": {
                "autor": None,
                "resumo": None,
                "link": None
            },
            "notaEditor": {
                "texto": None,
                "link": None
            },
            "capaRevista": {
                "imagem": None,
                "link": None
            }
        }
        titulo_div = soup.find("div", class_=re.compile(r"field--name-field-titulo"))
        if titulo_div:
            resultado["tituloEdicao"] = titulo_div.get_text(strip=True)

        sumario_wrapper = soup.find("div", class_="views-field-field-revista-sumario")
        if not sumario_wrapper:
            logger.warning("Container 'views-field-field-revista-sumario' não encontrado no HTML.")
        else:
            sumario_content = sumario_wrapper.find("div", class_="field--name-field-texto")
            if not sumario_content:
                logger.warning("Container 'field--name-field-texto' do sumário não encontrado.")
            else:
                def get_section_title_from_p(section_name: str) -> str:
                    for p in sumario_content.find_all("p"):
                        strong = p.find("strong")
                        if strong and section_name.lower() in strong.get_text(strip=True).lower():
                            next_p = p.find_next_sibling("p")
                            if next_p:
                                next_strong = next_p.find("strong")
                                if next_strong:
                                    return next_strong.get_text(strip=True)
                    return None
                
                resultado["sumario"]["cartaDoIbre"] = get_section_title_from_p("Carta do IBRE")
                resultado["sumario"]["pontoDeVista"] = get_section_title_from_p("Ponto de Vista")
                resultado["sumario"]["entrevista"] = get_section_title_from_p("Entrevista")
                
                resultado["sumario"]["capa"] = get_section_title_from_p("Capa")

                artigos_list = []
                found_artigos = False
                for p in sumario_content.find_all("p"):
                    strong = p.find("strong")
                    if strong:
                        text = strong.get_text(strip=True)
                        if "Artigos" in text:
                            found_artigos = True
                            continue
                        
                        if found_artigos:
                            if text:
                                artigos_list.append(text)
                
                resultado["sumario"]["artigos"] = artigos_list

                if (not resultado["sumario"]["cartaDoIbre"] and 
                    not resultado["sumario"]["pontoDeVista"] and 
                    not resultado["sumario"]["entrevista"] and 
                    not resultado["sumario"]["capa"] and 
                    not resultado["sumario"]["artigos"]):
                    logger.error("Todos os campos do sumário estão vazios ou None após o parsing.")

        absolutizar = lambda url: self._absolutizar(url)

        carta_match = re.search(
            r'block-views-block-revista-conjuntura-block-4[\s\S]*?<p[^>]*><em><strong>Por\s+([^<]+)</strong></em></p>[\s\S]*?<p[^>]*>([^<]+)',
            html
        )
        if carta_match:
            resultado["cartaIbre"]["autor"] = carta_match.group(1).strip()
            resultado["cartaIbre"]["resumo"] = carta_match.group(2).strip()

        carta_link_match = re.search(
            r'block-views-block-revista-conjuntura-block-4[\s\S]*?<a href="([^"]+)"',
            html
        )
        if carta_link_match:
            resultado["cartaIbre"]["link"] = absolutizar(carta_link_match.group(1))

        nota_match = re.search(r'block-views-block-revista-conjuntura-block-3[\s\S]*?<p>([\s\S]*?)</p>', html)
        if nota_match:
            resultado["notaEditor"]["texto"] = nota_match.group(1).strip()

        nota_link_match = re.search(r'block-views-block-revista-conjuntura-block-3[\s\S]*?<a href="([^"]+)"', html)
        if nota_link_match:
            resultado["notaEditor"]["link"] = absolutizar(nota_link_match.group(1))

        imagem_match = re.search(r'block-views-block-revista-conjuntura-block-2[\s\S]*?<img[^>]+src="([^"]+)"', html)
        if imagem_match:
            resultado["capaRevista"]["imagem"] = absolutizar(imagem_match.group(1))

        link_revista_match = re.search(
            r'block-views-block-revista-conjuntura-block-2[\s\S]*?<a href="([^"]+)"[^>]*>Leia a revista completa',
            html,
            re.IGNORECASE
        )
        if link_revista_match:
            resultado["capaRevista"]["link"] = absolutizar(link_revista_match.group(1))

        return resultado
