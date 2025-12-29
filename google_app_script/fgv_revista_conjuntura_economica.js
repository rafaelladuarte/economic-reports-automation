/*************************************************************
 * Scraper FGV Revista Conjuntura Econômica - Google Apps Script
 * - Faz fetch com headers e cookies (fornecidos)
 * - Detecta anti-bot
 * - Extrai seções e artigos
 * - Renderiza HTML
 * - Envia e-mail com htmlBody = HTML renderizado
 *************************************************************/

/* ======================
   CONFIGURAÇÃO (COOKIES + HEADERS)
   ====================== */

// COOKIES: string que você forneceu (já concatenada)
const COOKIES_STATIC = '_gcl_au=1.1.1927393907.1762952821; _hjSessionUser_5310947=eyJpZCI6ImM0ZmFjNmY3LTAwMWYtNTVjNS04NGMxLWQ1ZmRjMGMxODE1NyIsImNyZWF0ZWQiOjE3NjI5NTI4MjA4MTksImV4aXN0aW5nIjp0cnVlfQ==; _gid=GA1.2.932457876.1767030411; _ga_NFDKH7ZWK7=GS2.1.s1767030410$o6$g0$t1767030410$j60$l0$h0; _ga=GA1.1.814569633.1762952821; _hjSession_5310947=eyJpZCI6IjQ5MTMyYmI5LWNiOTAtNDFiOC1hYTJhLWExNDY4YjczZDEyOSIsImMiOjE3NjcwMzA0MTA5NTgsInMiOjAsInIiOjAsInNiIjowLCJzciI6MCwic2UiOjAsImZzIjowLCJzcCI6MH0=; _ga_D09E8P2WEF=GS2.2.s1767030411$o6$g0$t1767030411$j60$l0$h0; fgv_lgpd_agreement=ok';

// User-Agent (uso padrão, você pode alterar se desejar)
const DEFAULT_USER_AGENT = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36';

// URL alvo
const URL_FGV = 'https://portalibre.fgv.br/revista-conjuntura-economica';

// ID DA PLANILHA DE CONTROLE
const SPREADSHEET_ID = ""


/* ======================
   FLUXO PRINCIPAL
   ====================== */
function executarScraper() {
  Logger.log('Iniciando processo de extração da Revista Conjuntura Econômica...');
  // 1) Buscar HTML da página principal usando headers + cookies
  const mesCorrente = Utilities.formatDate(
    new Date(),
    Session.getScriptTimeZone(),
    "yyyy-MM"
  );

  if (jaFoiEnviadoNoMes(mesCorrente)) {
    Logger.log("E-mail já enviado para este mês. Abortando execução.");
    return;
  }

  const html = fetchPaginaFGV(URL_FGV);

  // 2) Extrair dados
  const dados = extrairDadosRevista(html);

  // 3) Gerar HTML do e-mail
  const htmlDoEmail = gerarHtmlEmail(dados);

  if (verificarMesAnoAtual(dados.tituloEdicao) === false) {
    const msg = `Nenhuma revista do FGV encontrado para o mês corrente. O processo foi encerrado.`;
    Logger.log(msg);
    return { status: 'Ignorado', mensagem: msg }; 
  }

    // 4) Enviar e-mail (corpo = HTML renderizado)
    const envio = enviarRelatorioPorEmail(dados, htmlDoEmail);

    Logger.log('Processo finalizado. Resultado do envio: ' + JSON.stringify(envio));
    registrarEnvioPlanilha(mesCorrente, dados.capaRevista.link);
    return { status: 'OK', envio, dadosResumo: { tituloEdicao: dados.tituloEdicao } };
}

/* ======================
   FETCH COM HEADERS E COOKIES
   ====================== */
function fetchPaginaFGV(url) {
  try {
    const headers = {
      'User-Agent': DEFAULT_USER_AGENT,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      // client hints (não todos são necessários, mas adicionados para fidelity)
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Cookie': COOKIES_STATIC
    };

    const options = {
      method: 'get',
      muteHttpExceptions: true,
      headers: headers,
      followRedirects: true,
      validateHttpsCertificates: true
    };

    Logger.log('Executando fetch com headers e cookies...');
    const response = UrlFetchApp.fetch(url, options);
    const code = response.getResponseCode();
    Logger.log('HTTP status: ' + code);

    const content = response.getContentText();

    // quick size/log
    Logger.log('Tamanho do HTML retornado: ' + (content ? content.length : 0) + ' caracteres');

    return content;
  } catch (e) {
    Logger.log('Erro no fetchPaginaFGV: ' + e.toString());
    return '';
  }
}

/* ======================
   DETECÇÃO ANTI-BOT
   ====================== */
function isAntiBot(html) {
  if (!html) return true;
  const lower = html.toLowerCase();

  // padrões comuns de páginas de proteção
  const indicators = [
    'antibot',
    'please enable javascript',
    'captcha',
    'cf-chl-bypass',
    'cf-challenge',
    'bot detection',
    'noscript',
    'antibot-message',
    'you are verifying',
    'verify you are human'
  ];

  for (let i = 0; i < indicators.length; i++) {
    if (lower.indexOf(indicators[i]) !== -1) {
      Logger.log('Indicador anti-bot detectado: ' + indicators[i]);
      return true;
    }
  }

  // Adicional: páginas muito curtas ou com <noscript><style> forms
  if (lower.indexOf('<noscript') !== -1 && lower.indexOf('form.antibot') !== -1) {
    Logger.log('Estrutura noscript/antibot detectada.');
    return true;
  }

  return false;
}

/* ======================
   EXTRAÇÃO DE DADOS (sem bibliotecas externas)
   - utiliza regex e fetch adicional para resumos
   ====================== */

  function extrairDadosRevista(html) {
  const resultado = {
    tituloEdicao: null,
    sumario: {
      cartaDoIbre: null,
      pontoDeVista: null,
      entrevista: null,
      capa: null,
      artigos: []
    },
    cartaIbre: {
      autor: null,
      resumo: null,
      link: null
    },
    notaEditor: {
      texto: null,
      link: null
    },
    capaRevista: {
      imagem: null,
      link: null
    }
  };

  // ======================================================
  // TÍTULO DA EDIÇÃO (original)
  // ======================================================
  const tituloMatch = html.match(
    /field--name-field-titulo[^>]*>\s*([^<]+?)\s*<\/div>/
  );
  if (tituloMatch) {
    resultado.tituloEdicao = tituloMatch[1].trim();
  }

  // ======================================================
  // SUMÁRIO — BLOCO INTERNO (AJUSTADO)
  // ======================================================
  const sumarioMatch = html.match(
    /views-field-field-revista-sumario[\s\S]*?<div class="field[^"]*field--name-field-texto[^"]*field__item">([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/i
  );

  if (sumarioMatch) {
    const textoSumario = sumarioMatch[1];

    function extrairSecaoSumario(nome) {
      const regex = new RegExp(
        `<h2>\\s*<strong>${nome}<\\/strong>\\s*<\\/h2>[\\s\\S]*?<h3>\\s*<strong>([\\s\\S]*?)<\\/strong>[\\s\\S]*?<\\/h3>[\\s\\S]*?<p[^>]*>([\\s\\S]*?)<\\/p>`,
        "i"
      );

      const match = textoSumario.match(regex);
      if (!match) return null;

      return {
        titulo: match[1].replace(/\s+/g, " ").trim(),
        resumo: match[2].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim()
      };
    }

    resultado.sumario.cartaDoIbre  = extrairSecaoSumario("Carta do IBRE");
    resultado.sumario.pontoDeVista = extrairSecaoSumario("Ponto de Vista");
    resultado.sumario.entrevista   = extrairSecaoSumario("Entrevista");
    resultado.sumario.capa         = extrairSecaoSumario("CAPA");

    // -------- LISTA DE ARTIGOS (AJUSTADA) --------
    const artigosMatch = textoSumario.match(
      /<h2>\s*Artigos\s*<\/h2>([\s\S]*)$/i
    );

    if (artigosMatch) {
      const artigosHtml = artigosMatch[1];
      const regexArtigos =
        /<p[^>]*>\s*<strong>\s*(\d+\s+[^<]+?)\s*<\/strong>\s*<\/p>\s*<p[^>]*>\s*<em>\s*([^<]+?)\s*<\/em>\s*<\/p>/g;

      let m;
      while ((m = regexArtigos.exec(artigosHtml)) !== null) {
        resultado.sumario.artigos.push({
          titulo: m[1].trim(),
          autor: m[2].trim()
        });
      }
    }
  }

  // ======================================================
  // CARTA DO IBRE (FORA DO SUMÁRIO) — ORIGINAL
  // ======================================================
  const cartaMatch = html.match(
    /block-views-block-revista-conjuntura-block-4[\s\S]*?<p[^>]*><em><strong>Por\s+([^<]+)<\/strong><\/em><\/p>[\s\S]*?<p[^>]*>([^<]+)/
  );

  if (cartaMatch) {
    resultado.cartaIbre.autor = cartaMatch[1].trim();
    resultado.cartaIbre.resumo = cartaMatch[2].trim();
  }

  const cartaLinkMatch = html.match(
    /block-views-block-revista-conjuntura-block-4[\s\S]*?<a href="([^"]+)"/
  );
  if (cartaLinkMatch) {
    resultado.cartaIbre.link = cartaLinkMatch[1];
  }

  // ======================================================
  // NOTA DO EDITOR — ORIGINAL
  // ======================================================
  const notaMatch = html.match(
    /block-views-block-revista-conjuntura-block-3[\s\S]*?<p>([\s\S]*?)<\/p>/
  );
  if (notaMatch) {
    resultado.notaEditor.texto = notaMatch[1].trim();
  }

  const notaLinkMatch = html.match(
    /block-views-block-revista-conjuntura-block-3[\s\S]*?<a href="([^"]+)"/
  );
  if (notaLinkMatch) {
    resultado.notaEditor.link = notaLinkMatch[1];
  }

  // ======================================================
  // CAPA DA REVISTA (IMAGEM + LINK) — ORIGINAL
  // ======================================================
  const imagemMatch = html.match(
    /block-views-block-revista-conjuntura-block-2[\s\S]*?<img[^>]+src="([^"]+)"/
  );
  if (imagemMatch) {
    resultado.capaRevista.imagem = imagemMatch[1];
  }

  const linkRevistaMatch = html.match(
    /block-views-block-revista-conjuntura-block-2[\s\S]*?<a href="([^"]+)"[^>]*>Leia a revista completa/
  );
  if (linkRevistaMatch) {
    resultado.capaRevista.link = linkRevistaMatch[1];
  }

  return resultado;
}

/* ======================
   GERAR HTML DO E-MAIL
   ====================== */
function gerarHtmlEmail(dadosJson) {
  
  // Verifica se o objeto principal e o sumário existem
  if (!dadosJson || !dadosJson.sumario) {
    Logger.log("Erro: Objeto de dados JSON inválido ou vazio.");
    return "<h1>Erro ao gerar HTML: Dados ausentes</h1>";
  }

  // Desestruturação para facilitar o acesso aos dados
  var tituloEdicao = dadosJson.tituloEdicao || "Revista Conjuntura Econômica";
  var sumario = dadosJson.sumario;
  var cartaIbre = dadosJson.cartaIbre || {};
  var notaDoEditor = dadosJson.notaEditor || {};
  var capa = dadosJson.capaRevista || {};

  // --- 1. Geração da Lista de Artigos do Sumário (usando o array de artigos) ---
  
  // Itera sobre o array de artigos e cria uma string HTML com <li> para cada um.
  var listaArtigosHtml = sumario.artigos.map(function(artigo) {
    var titulo = artigo.titulo || "Título não disponível";
    var autor = artigo.autor ? " - " + artigo.autor : "";
    return '    <li>' + titulo + autor + '</li>';
  }).join('\n'); // Junta todos os <li> com uma quebra de linha

  // --- 2. Geração da Lista de Seções Fixas do Sumário ---
  
  // Cria os <li> para as seções fixas (usando os títulos completos do sumário)
  var listaSecoesHtml = `
  <li>
    <strong>Carta do IBRE:</strong><br>
    <em>${sumario.cartaDoIbre && sumario.cartaDoIbre.titulo ? sumario.cartaDoIbre.titulo.trim() : "Não disponível"}</em><br>
    ${sumario.cartaDoIbre && sumario.cartaDoIbre.resumo ? sumario.cartaDoIbre.resumo.trim() : ""}
  </li>

  <li>
    <strong>Ponto de Vista:</strong><br>
    <em>${sumario.pontoDeVista && sumario.pontoDeVista.titulo ? sumario.pontoDeVista.titulo.trim() : "Não disponível"}</em><br>
    ${sumario.pontoDeVista && sumario.pontoDeVista.resumo ? sumario.pontoDeVista.resumo.trim() : ""}
  </li>

  <li>
    <strong>Entrevista:</strong><br>
    <em>${sumario.entrevista && sumario.entrevista.titulo ? sumario.entrevista.titulo.trim() : "Não disponível"}</em><br>
    ${sumario.entrevista && sumario.entrevista.resumo ? sumario.entrevista.resumo.trim() : ""}
  </li>

  <li>
    <strong>Fiscal:</strong><br>
    <em>Não disponível</em>
  </li>

  <li>
    <strong>Capa:</strong><br>
    <em>${sumario.capa && sumario.capa.titulo ? sumario.capa.titulo.trim() : "Não disponível"}</em><br>
    ${sumario.capa && sumario.capa.resumo ? sumario.capa.resumo.trim() : ""}
  </li>
`.trim();


  // --- 3. Montagem do Template HTML Completo ---

  var htmlTemplate = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8" />
<title>${tituloEdicao}</title>
<style>
    /* Estilos básicos para garantir boa visualização em emails */
    body { font-family: Arial, sans-serif; background: #f8f8f8; margin: 0; padding: 20px; }
    .container { background: white; max-width: 800px; margin: auto; padding: 20px; border-radius: 8px; box-shadow: 0 0 10px rgba(0,0,0,0.1); }
    h1 { font-size: 24px; color: #333; margin-bottom: 8px; border-bottom: 2px solid #0056b3; padding-bottom: 5px; }
    h2 { font-size: 18px; color: #0056b3; border-bottom: 1px solid #ddd; padding-bottom: 4px; margin-top: 28px; }
    ul { padding-left: 18px; line-height: 1.4; margin-bottom: 20px; }
    ul li { margin-bottom: 5px; }
    .capa img { max-width: 100%; height: auto; border-radius: 6px; margin: 10px 0; display: block; }
    .footer { margin-top: 30px; padding: 12px; background: #efefef; text-align: center; font-size: 12px; color: #666; border-radius: 0 0 8px 8px; }
    .content p { margin-bottom: 15px; line-height: 1.5; }
    .read-more-link { display: inline-block; margin-top: 5px; background-color: #007bff; color: white !important; padding: 8px 15px; text-decoration: none; border-radius: 4px; }
</style>
</head>
<body>
<div class="container">

<h1>${tituloEdicao}</h1>

<h2>Sumário da Edição</h2>
<ul>
${listaSecoesHtml}
</ul>

<h2>Lista de Artigos</h2>
<ul>
${listaArtigosHtml}
</ul>

<h2>Carta do IBRE</h2>
<div class="content">
    <p>${cartaIbre.resumo || "Resumo da Carta do IBRE não disponível."}</p>
    <p><a href="https://portalibre.fgv.br/${cartaIbre.link || "#"}" class="read-more-link" target="_blank">Ler mais</a></p>
</div>

<h2>Nota do Editor</h2>
<div class="content">
    <p>${notaDoEditor.texto || "Resumo da Nota do Editor não disponível."}</p>
    <p><a href="https://portalibre.fgv.br/${notaDoEditor.link || "#"}" class="read-more-link" target="_blank">Ler mais</a></p>
</div>

<h2>Capa</h2>
<div class="capa">
    <img src="https://portalibre.fgv.br/${capa.imagem || "placeholder.jpg"}" alt="Capa da Revista">
</div>
<p><a href="${capa.link || "#"}" class="read-more-link" target="_blank">Acessar revista completa</a></p>

<div class="footer">
    Email gerado automaticamente pelo Google Apps Script.
</div>

</div>
</body>
</html>
  `;

  return htmlTemplate.trim();
}

/* ======================
   ENVIO POR E-MAIL (HTML COMO CORPO)
   ====================== */
function enviarRelatorioPorEmail(dados, htmlBody) {
  try {
    const emailDestino = Session.getActiveUser().getEmail();
    const dataDeHojeFormatada = getCurrentDateFormatted(); 
    const assunto = `Revista Conjuntura Econômica (FGV) - ${dataDeHojeFormatada}`;

    // Envia apenas o HTML como corpo (texto alternativo vazio)
    GmailApp.sendEmail(String(emailDestino), String(assunto), '', {
      htmlBody: String(htmlBody)
    });

    Logger.log('E-mail enviado para ' + emailDestino);
    return { status: 'Sucesso', destinatario: emailDestino };
  } catch (e) {
    Logger.log('Erro ao enviar e-mail: ' + e.toString());
    return { status: 'Erro', mensagem: e.toString() };
  }
}


/* ======================
   FUNÇÕES AUXILIARES
   ====================== */

function getCurrentDateFormatted() {
  const date = new Date();
  const options = { day: 'numeric', month: 'long', year: 'numeric' };
  const formattedDate = date.toLocaleDateString('pt-BR', options);

  return formattedDate.replace(/,/g, '').toLowerCase().trim();
}

function verificarMesAnoAtual(titulo) {
  if (!titulo || typeof titulo !== 'string') return false;

  // 1. Extrair a parte após o pipe
  // Ex: "Revista Conjuntura Econômica | Novembro 2025"
  const partes = titulo.split('|');
  if (partes.length < 2) return false;

  const textoData = partes[1].trim(); // "Novembro 2025"

  // 2. Regex para capturar "Mês Ano"
  const m = textoData.match(/([A-Za-zçéãîôâÇÉÃÔÂ]+)\s+(\d{4})/i);
  if (!m) return false;

  const mesTexto = m[1].trim().toLowerCase();
  const anoTexto = parseInt(m[2], 10);

  // 3. Mapeamento meses → número (0–11)
  const meses = {
    'janeiro': 0, 'fevereiro': 1, 'março': 2, 'marco': 2, 'abril': 3,
    'maio': 4, 'junho': 5, 'julho': 6, 'agosto': 7,
    'setembro': 8, 'outubro': 9, 'novembro': 10, 'dezembro': 11
  };

  const mesNumero = meses[mesTexto];
  if (mesNumero === undefined) return false;

  // 4. Obter mês e ano correntes (Apps Script usa timezone default)
  const hoje = new Date();
  const mesAtual = hoje.getMonth();     // 0–11
  const anoAtual = hoje.getFullYear();  // YYYY

  // 5. Comparação
  return mesNumero === mesAtual && anoTexto === anoAtual;
}

function extrairRegex(texto, regex) {
  if (!texto) return '';
  const m = texto.match(regex);
  return m && m[1] ? m[1].trim() : '';
}

function limparHTML(html) {
  if (!html) return '';
  return (html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<\/?[^>]+(>|$)/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function limparTexto(s) {
  if (!s) return '';
  return String(s).replace(/\r/g, ' ').replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
}

function absolutizar(urlOrRel) {
  if (!urlOrRel) return '';
  if (urlOrRel.indexOf('http') === 0) return urlOrRel;
  // concatena com domínio base
  return 'https://portalibre.fgv.br' + (urlOrRel.indexOf('/') === 0 ? urlOrRel : '/' + urlOrRel);
}

function registrarEnvioPlanilha(mesCorrente, linkRevista) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName("controle");

  if (!sheet) {
    throw new Error("A aba 'controle' não existe.");
  }

  sheet.appendRow([
    new Date(),
    mesCorrente,
    linkRevista
  ]);
}

function jaFoiEnviadoNoMes(mesCorrente) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName("controle");

  if (!sheet) {
    throw new Error("A aba 'controle' não existe.");
  }

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    Logger.log("Planilha sem registros de envio.");
    return false;
  }

  const valores = sheet.getRange(2, 2, lastRow - 1, 1).getValues();

  for (let i = 0; i < valores.length; i++) {
    let valor = valores[i][0];

    if (!valor) continue;

    // Normaliza qualquer valor para YYYY-MM
    let mesPlanilha;

    if (valor instanceof Date) {
      mesPlanilha = Utilities.formatDate(
        valor,
        Session.getScriptTimeZone(),
        "yyyy-MM"
      );
    } else {
      mesPlanilha = String(valor).trim();
    }

    Logger.log(`Comparando: planilha=${mesPlanilha} | atual=${mesCorrente}`);

    if (mesPlanilha === mesCorrente) {
      Logger.log("Envio já registrado para este mês.");
      return true;
    }
  }

  Logger.log("Nenhum envio encontrado para este mês.");
  return false;
}