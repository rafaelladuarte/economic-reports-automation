/*************************************************************
 * Scraper FGV Revista Conjuntura Econômica - Google Apps Script
 * - Faz fetch com headers e cookies
 * - Extrai seções e artigos
 * - Renderiza HTML
 * - Envia e-mail com htmlBody = HTML renderizado
 *************************************************************/

/* ======================
   CONFIGURAÇÃO (COOKIES + HEADERS)
   ====================== */

// COOKIES: string que você forneceu (já concatenada)
const COOKIES_STATIC = '_gcl_au=1.1.1927393907.1762952821; _hjSessionUser_5310947=eyJpZCI6ImM0ZmFjNmY3LTAwMWYtNTVjNS04NGMxLWQ1ZmRjMGMxODE1NyIsImNyZWF0ZWQiOjE3NjI5NTI4MjA4MTksImV4aXN0aW5nIjp0cnVlfQ==; fgv_lgpd_agreement=ok; _gid=GA1.2.1581351493.1765403340; _gat_UA-5652209-23=1; _hjSession_5310947=eyJpZCI6ImUzYmVmMTUwLTU0NDctNGE1OS05YTMwLTA3ZDBiMDdjZmIxNyIsImMiOjE3NjU0MDc1OTIzOTMsInMiOjAsInIiOjAsInNiIjowLCJzciI6MCwic2UiOjAsImZzIjowLCJzcCI6MH0=; _ga_NFDKH7ZWK7=GS2.1.s1765407591$o4$g1$t1765407592$j59$l0$h0; _ga=GA1.1.814569633.1762952821; _ga_D09E8P2WEF=GS2.2.s1765407592$o4$g0$t1765407592$j60$l0$h0';

// User-Agent (uso padrão, você pode alterar se desejar)
const DEFAULT_USER_AGENT = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36';

// URL alvo
const URL_FGV = 'https://portalibre.fgv.br/revista-conjuntura-economica';

/* ======================
   FLUXO PRINCIPAL
   ====================== */
function executarScraper() {
  Logger.log('Iniciando processo de extração da Revista Conjuntura Econômica...');
  // 1) Buscar HTML da página principal usando headers + cookies
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
   EXTRAÇÃO DE DADOS
   ====================== */
function extrairDadosRevista(html) {
  
  var resultado = {
    tituloEdicao: null,
    sumario: { artigos: [] },
    cartaIbre: {},
    notaDoEditor: {},
    capa: {}
  };

  // --- 1. Extração do Sumário (Bloco 1) ---
  
  // Localiza a seção de sumário: div com id 'block-views-block-revista-conjuntura-block-1'
  var regexSumarioBloco = /id="block-views-block-revista-conjuntura-block-1"[\s\S]*?views-row"><div class="views-field views-field-field-revista-sumario">([\s\S]*?)<\/div><div class="views-field views-field-edit-node">/;
  var matchSumarioBloco = html.match(regexSumarioBloco);
  
  if (matchSumarioBloco && matchSumarioBloco[1]) {
    var sumarioHtml = matchSumarioBloco[1];

    // A. Título da Edição (dentro do sumário)
    var regexTituloEdicao = /rotulo-default[^>]*>([\s\S]*?)<\/div>/;
    var matchTitulo = sumarioHtml.match(regexTituloEdicao);
    if (matchTitulo && matchTitulo[1]) {
      var tituloEdicao = limparTexto(matchTitulo[1]);
      resultado.tituloEdicao = tituloEdicao;
      resultado.sumario.tituloEdicao = tituloEdicao;
    }

    // B. Conteúdo Principal do Sumário (Seções e Artigos)
    var regexConteudoSumario = /field--name-field-texto[^>]*>([\s\S]*?)<\/div>/;
    var matchConteudo = sumarioHtml.match(regexConteudoSumario);
    
    if (matchConteudo && matchConteudo[1]) {
      var conteudoTexto = matchConteudo[1];
      
      // Simplifica o HTML interno para facilitar a análise linha por linha
      var textoLimpo = conteudoTexto
        .replace(/<p>\s*<strong>/g, '\n**') // Marcar início de Títulos/Seções
        .replace(/<\/strong>/g, '**\n')    // Marcar fim de Títulos/Seções
        .replace(/<p><em>/g, '\n$$')       // Marcar início de Autores (que estão em <em>)
        .replace(/<\/em><\/p>/g, '$$\n')   // Marcar fim de Autores
        .replace(/<p>/g, '\n')             // Quebra de linha para outros parágrafos
        .replace(/<\/p>/g, '')
        .replace(/\s\s+/g, ' ');           // Limpeza geral
      
      var linhas = textoLimpo.split('\n').filter(function(line) { return line.trim().length > 0; });
      
      var processandoArtigos = false;
      var artigoAtual = null;

      for (var i = 0; i < linhas.length; i++) {
        var linha = linhas[i].trim();
        
        if (linha.includes('**Artigos**')) {
          processandoArtigos = true;
          continue;
        }

        var matchSecao = linha.match(/\*\*(Carta do IBRE|Ponto de Vista|Entrevista|Fiscal|CAPA)\s*\|\s*(.*?)\*\*/);
        
        if (matchSecao) {
          // É uma seção fixa
          var tipo = matchSecao[1];
          var tituloCompleto = limparTexto(matchSecao[0].replace(/\*\*/g, ''));
          
          switch (tipo) {
            case 'Carta do IBRE':
              resultado.sumario.cartaDoIbre = tituloCompleto;
              break;
            case 'Ponto de Vista':
              resultado.sumario.pontoDeVista = tituloCompleto;
              break;
            case 'Entrevista':
              resultado.sumario.entrevista = tituloCompleto;
              break;
            case 'Fiscal':
              resultado.sumario.fiscal = tituloCompleto;
              break;
            case 'CAPA':
              resultado.sumario.capa = tituloCompleto;
              break;
          }
        } else if (processandoArtigos) {
          // Extração de Artigos e Autores
          if (linha.startsWith('**') && linha.endsWith('**')) {
            // Nova linha de Título de Artigo
            if (artigoAtual) {
              resultado.sumario.artigos.push(artigoAtual);
            }
            artigoAtual = {
              titulo: limparTexto(linha.replace(/\*\*/g, '')),
              autor: null
            };
          } else if (linha.startsWith('$$') && linha.endsWith('$$') && artigoAtual) {
            // Linha de Autor
            artigoAtual.autor = limparTexto(linha.replace(/\$\$/g, ''));
          }
        }
      }
      // Adiciona o último artigo
      if (artigoAtual) {
        resultado.sumario.artigos.push(artigoAtual);
      }
    }
  }
  
  // --- 2. Extração da Carta do IBRE (Bloco 4) ---
  
  var regexCarta = /id="block-views-block-revista-conjuntura-block-4"[\s\S]*?field-content">([\s\S]*?)<\/span>[\s\S]*?<a href="(.*?)"/i;
  var matchCarta = html.match(regexCarta);
  
  if (matchCarta) {
    resultado.cartaIbre.resumo = limparTexto(matchCarta[1]);
    resultado.cartaIbre.link = matchCarta[2].replace('hreflang="pt-br"', '').trim();
  }

  // --- 3. Extração da Nota do Editor (Bloco 3) ---
  
  var regexNota = /id="block-views-block-revista-conjuntura-block-3"[\s\S]*?field-content">([\s\S]*?)<\/div>[\s\S]*?<a href="(.*?)"/i;
  var matchNota = html.match(regexNota);
  
  if (matchNota) {
    resultado.notaDoEditor.resumo = limparTexto(matchNota[1]);
    resultado.notaDoEditor.link = matchNota[2].replace('hreflang="pt-br"', '').trim();
  }
  
  // --- 4. Extração da Capa (Bloco 2) ---

  var regexCapa = /id="block-views-block-revista-conjuntura-block-2"[\s\S]*?views-field-field-revista-imagem">[\s\S]*?<img[^>]*src="(.*?)"[\s\S]*?views-field-field-revista-link">[\s\S]*?<a href="(.*?)" class="btn-azul-pequeno f-right"/i;
  var matchCapa = html.match(regexCapa);

  if (matchCapa) {
    resultado.capa.imagem = matchCapa[1].trim();
    resultado.capa.linkRevistaCompleta = matchCapa[2].trim();
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
  var notaDoEditor = dadosJson.notaDoEditor || {};
  var capa = dadosJson.capa || {};

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
    <li><strong>Carta do IBRE:</strong> ${sumario.cartaDoIbre ? sumario.cartaDoIbre.replace('Carta do IBRE | ', '').trim() : "Não disponível"}</li>
    <li><strong>Ponto de Vista:</strong> ${sumario.pontoDeVista ? sumario.pontoDeVista.replace('Ponto de Vista | ', '').trim() : "Não disponível"}</li>
    <li><strong>Entrevista:</strong> ${sumario.entrevista ? sumario.entrevista.replace('Entrevista | ', '').trim() : "Não disponível"}</li>
    <li><strong>Fiscal:</strong> ${sumario.fiscal ? sumario.fiscal.replace('Fiscal | ', '').trim() : "Não disponível"}</li>
    <li><strong>Capa:</strong> ${sumario.capa ? sumario.capa.replace('CAPA | ', '').trim() : "Não disponível"}</li>
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
    <p>${notaDoEditor.resumo || "Resumo da Nota do Editor não disponível."}</p>
    <p><a href="https://portalibre.fgv.br/${notaDoEditor.link || "#"}" class="read-more-link" target="_blank">Ler mais</a></p>
</div>

<h2>Capa</h2>
<div class="capa">
    <img src="https://portalibre.fgv.br/${capa.imagem || "placeholder.jpg"}" alt="Capa da Revista">
</div>
<p><a href="${capa.linkRevistaCompleta || "#"}" class="read-more-link" target="_blank">Acessar revista completa</a></p>

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
