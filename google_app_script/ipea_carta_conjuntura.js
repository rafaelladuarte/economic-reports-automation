function getCurrentDateFormatted() {
  const date = new Date();
  const options = { day: 'numeric', month: 'long', year: 'numeric' };
  const formattedDate = date.toLocaleDateString('pt-BR', options);

  return formattedDate.replace(/,/g, '').toLowerCase().trim();
}

function buscarHtmlIpea() {
  const url = 'https://www.ipea.gov.br/cartadeconjuntura/';
  
  Logger.log(`Iniciando requisição GET para: ${url}`);
  
  try {
    const response = UrlFetchApp.fetch(url);
    const htmlContent = response.getContentText();
    
    Logger.log('Requisição concluída com sucesso. Tamanho do HTML retornado: ' + htmlContent.length + ' caracteres.');

    return htmlContent;
    
  } catch (e) {
    Logger.log('Erro ao buscar HTML: ' + e.toString());

    return 'ERRO: Falha na requisição. Detalhes: ' + e.toString();
  }
}

function parseHtmlForReport(htmlString, targetDate) {
  const defaultResult = {
    titulo: 'Não encontrado',
    data: 'Não encontrada',
    resumo: 'Não encontrado',
    link: 'Não encontrado',
    linkPdf: 'Não encontrado'
  };

  if (typeof htmlString !== 'string' || htmlString.length === 0) {
      Logger.log("ERRO DE TIPO: O conteúdo HTML fornecido para parsing não é uma string válida.");
      return defaultResult;
  }

  const articleBlocks = htmlString.match(/<article[\s\S]*?<\/article>/g) || [];
  
  if (articleBlocks.length === 0) {
    Logger.log("Nenhum bloco <article> encontrado no HTML.");
    return defaultResult;
  }
  
  Logger.log(`Procurando relatório publicado na data: ${targetDate}`);

  for (const articleHtml of articleBlocks) {
    let currentResult = Object.assign({}, defaultResult);

    const dateRegex = /<time class="entry-date"[^>]*>([\s\S]*?)<\/time>/i;
    const dateMatch = articleHtml.match(dateRegex);
    
    if (dateMatch) {
      const extractedDate = dateMatch[1].replace(/[\r\n\t]/g, '').replace(/,/g, '').toLowerCase().trim();
      currentResult.data = extractedDate;

      if (extractedDate !== targetDate) {
        continue; 
      }

      const titleLinkRegex = /<h1 class="entry-title">\s*<a href="(.*?)"[^>]*>([\s\S]*?)<\/a>\s*<\/h1>/i;
      const titleMatch = articleHtml.match(titleLinkRegex);
      
      if (titleMatch) {
        currentResult.link = titleMatch[1].trim();
        currentResult.titulo = titleMatch[2].replace(/<[^>]*>/g, '').replace(/[\r\n\t]/g, '').trim();
      }

      const contentRegex = /<div class="entry-content">([\s\S]*?)<\/div>/i;
      const contentMatch = articleHtml.match(contentRegex);
      
      if (contentMatch) {
        let contentHtml = contentMatch[1];
        
        const paragraphs = contentHtml.match(/<p[\s\S]*?>([\s\S]*?)<\/p>/g) || [];
        let summaryText = [];
        
        paragraphs.forEach(p => {
            let text = p.replace(/<[^>]*>/g, '').trim();
            if (text && !text.toLowerCase().includes('acesse o texto completo') && !text.toLowerCase().includes('dados xls')) {
                summaryText.push(text);
            }
        });
        
        currentResult.resumo = summaryText.join('\n\n').trim();
        
        const pdfLinkRegex = /href="(.*?\.pdf)"/i;
        const pdfLinkMatch = contentHtml.match(pdfLinkRegex);
        
        if (pdfLinkMatch) {
          currentResult.linkPdf = pdfLinkMatch[1];
        }
      }

      return currentResult;

    }
  }

  Logger.log("Nenhum relatório encontrado para a data de hoje.");
  return defaultResult;
}

function enviarRelatorioPorEmail() {
  const emailDestino = Session.getActiveUser().getEmail(); 
  
  Logger.log(`Iniciando busca e envio do relatório por e-mail para: ${emailDestino}`);

  const dataDeHojeFormatada = getCurrentDateFormatted(); 
  const html = buscarHtmlIpea();
  
  if (html.startsWith('ERRO:')) {
    Logger.log('Falha na busca, e-mail não enviado.');
    return { status: 'Erro', mensagem: html };
  }
  
  const dadosRelatorio = parseHtmlForReport(html, dataDeHojeFormatada);

  if (dadosRelatorio.titulo === 'Não encontrado') {
    const msg = `Nenhum relatório do IPEA encontrado para a data: ${dataDeHojeFormatada}. O processo foi encerrado.`;
    Logger.log(msg);
    return { status: 'Ignorado', mensagem: msg }; 
  }

  const assunto = `Relatório IPEA: ${dadosRelatorio.titulo} (${dadosRelatorio.data})`;
  
  const corpoEmail = `
    <div style="font-family: Arial, Helvetica, sans-serif; background-color: #f5f6f8; padding: 24px;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 6px; padding: 24px;">

    <h1 style="margin: 0 0 8px 0; font-size: 22px; color: #1f2937;">
      Relatório Carta de Conjuntura – IPEA
    </h1>

    <h2 style="margin: 0 0 16px 0; font-size: 18px; font-weight: normal; color: #374151;">
      ${dadosRelatorio.titulo}
    </h2>

    <p style="margin: 0 0 20px 0; font-size: 14px; color: #4b5563;">
      <strong>Data de publicação:</strong> ${dadosRelatorio.data}
    </p>

    <h3 style="margin: 0 0 8px 0; font-size: 16px; color: #1f2937;">
      Resumo
    </h3>

    <div style="background-color: #f9fafb; border-left: 4px solid #2563eb; padding: 12px 16px; margin-bottom: 20px;">
      <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #374151; white-space: pre-wrap;">
        ${dadosRelatorio.resumo}
      </p>
    </div>

    <p style="margin: 0 0 24px 0; font-size: 14px;">
      <strong>Link para o PDF:</strong><br>
      <a href="${dadosRelatorio.linkPdf}" style="color: #2563eb; text-decoration: none;">
        ${dadosRelatorio.linkPdf}
      </a>
    </p>

    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">

    <p style="margin: 0; font-size: 12px; color: #6b7280;">
      Este e-mail foi gerado automaticamente pelo Google Apps Script.
    </p>

  </div>
</div>
  `;
  
  const corpoTextoSimples = `Relatório IPEA: ${dadosRelatorio.titulo}\n\nData: ${dadosRelatorio.data}\n\nResumo:\n${dadosRelatorio.resumo}\n\nLink: ${dadosRelatorio.link}`;

  try {
    GmailApp.sendEmail(
      String(emailDestino),
      String(assunto),
      String(corpoTextoSimples),
      { 
        htmlBody: String(corpoEmail)
      }
    );
    Logger.log(`E-mail enviado com sucesso para ${emailDestino}`);
    return { status: 'Sucesso', mensagem: `E-mail enviado para ${emailDestino}.` };
  } catch (e) {
    Logger.log('Erro ao enviar e-mail: ' + e.toString());
    return { status: 'Erro', mensagem: 'Falha ao enviar e-mail: ' + e.toString() };
  }
}


function iniciarProcessoRelatorio() {
  const statusEnvio = enviarRelatorioPorEmail();

  Logger.log('--- STATUS FINAL DO PROCESSO ---');
  Logger.log(statusEnvio);
  Logger.log('--------------------------');

  return statusEnvio;
}