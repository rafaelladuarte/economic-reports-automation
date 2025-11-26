# 📡 Automação de Relatórios Econômicos

**Monitoramento automático de publicações e envio de alertas inteligentes**

Este repositório reúne um conjunto de automações desenvolvidas para monitorar **relatórios econômicos publicados por instituições oficiais** e enviar notificações automáticas quando novos documentos forem disponibilizados.

O projeto é modular, expansível e construído inteiramente com **Google Apps Script (GAS)**, permitindo operações em nuvem, baixo custo e execução totalmente automatizada. Atualmente, o primeiro módulo monitora a **Carta de Conjuntura do IPEA**, mas novos relatórios serão adicionados ao longo do desenvolvimento.

## 🎯 Propósito do Projeto

A automação foi criada para resolver um desafio recorrente: **acompanhar publicações econômicas importantes sem depender de verificações manuais diárias**.

A solução:

* Monitora páginas oficiais de relatórios econômicos.
* Identifica novas publicações na data atual.
* Extrai informações relevantes (título, data, resumo e links).
* Envia um **e-mail automático em HTML** com os detalhes.
* Evita notificações redundantes ao ignorar dias sem novas publicações.

Ideal para quem trabalha com dados, pesquisa econômica, análise de conjuntura ou rotina baseada em documentos oficiais.

## 🧩 Estrutura Modular do Projeto

Cada relatório econômico monitorado possui seu próprio módulo independente.
**Módulos atuais:**

* 📄 *[Carta de Conjuntura — IPEA](https://www.ipea.gov.br/cartadeconjuntura/)* (implementado)

**Próximos módulos planejados:**

* 📘 *[Revista Conjuntura - FGV](https://portalibre.fgv.br/revista-conjuntura-economica)*
* 📊 *[Boletim Macro- FGV](https://portalibre.fgv.br/boletim-macro)*
* 🏛️ *[Estudos Especiais - Banco Central](https://www.bcb.gov.br/publicacoes/estudosespeciais)*
* 📈 Relatórios e boletins adicionais de instituições públicas e privadas

## 🛠️ Tecnologias Utilizadas

O projeto funciona inteiramente dentro do ecossistema Google utilizando:

| Tecnologia / Serviço         | Função                                                                |
| ---------------------------- | --------------------------------------------------------------------- |
| **Google Apps Script (GAS)** | Ambiente de execução baseado em JavaScript.                           |
| **JavaScript (JS)**          | Implementa lógica, parsing, regras e modularização.                   |
| **UrlFetchApp**              | Faz requisições HTTP para buscar o conteúdo das páginas.              |
| **RegEx**                    | Extrai dados específicos do HTML quando não há DOM Parser disponível. |
| **GmailApp**                 | Envia e-mails em HTML para o usuário.                                 |
| **Time-driven Triggers**     | Executa a automação diariamente ou em intervalos definidos.           |

## 📬 Como Funciona

1. O script acessa a página de um relatório econômico.
2. Verifica se há uma nova publicação na data atual.
3. Extrai:

   * Título
   * Data
   * Resumo
   * Link da página
   * Link do PDF (quando disponível)
4. Gera um e-mail estruturado em HTML.
5. Envia o alerta automático ao usuário.

## 🚀 Roadmap

* Adição de novos relatórios econômicos (FGV, BACEN, IPEA e outros).
* Implementação de **resumos automáticos com modelos de linguagem (LLM)**.
* Exportação de dados para planilhas Google de forma estruturada.

## ⚙️ Como Configurar

1. Crie um novo projeto no Google Apps Script.
2. Copie o código do módulo desejado (ex.: `ipea_carta_conjuntura.js`).
3. Configure um **gatilho de tempo** para rodar a função principal do módulo.
4. Na primeira execução, conceda as permissões solicitadas:
   * UrlFetchApp
   * GmailApp
