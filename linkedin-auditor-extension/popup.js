const API_URL = 'http://127.0.0.1:5000/analizar';

/* ============================================================
   MODO OFERTA: se ejecuta dentro de la pestaña de LinkedIn
   ============================================================ */
function extraerOferta() {
  const limpiar = (s) => (s || '').replace(/\s+\n/g, '\n').trim();

  // 1. Bloque de la descripción
  let descEl = null;
  const selectores = [
    '.jobs-description__content',
    '#job-details',
    '[class*="jobs-description"]',
    '[data-testid="expandable-text-box"]'
  ];
  for (const sel of selectores) {
    const el = document.querySelector(sel);
    if (el && el.innerText.trim().length > 100) { descEl = el; break; }
  }

  // 2. Plan B: encabezado "Acerca del empleo" / "About the job"
  if (!descEl) {
    const reTitulo = /^(acerca del empleo|acerca de la oferta|sobre el empleo|about the job)$/i;
    const cab = [...document.querySelectorAll('h1,h2,h3,h4,p,span,div')]
      .find((el) => el.children.length === 0 && reTitulo.test(el.textContent.trim()));
    if (cab) {
      let n = cab;
      while (n.parentElement && n.parentElement !== document.body &&
             n.parentElement.innerText.length < 400) {
        n = n.parentElement;
      }
      descEl = n.parentElement || n;
    }
  }
  if (!descEl) return null;

  const descripcion = limpiar(descEl.innerText);

  // 3. Panel de la oferta y empresa (ignorando enlaces de ruido como "Premium")
  const reRuido = /premium|mostrar|show|probar|try|seguir|follow|ver m[aá]s|see more|informaci[oó]n|insights|candidat|applicant/i;
  const enlaceValido = (a) => {
    const t = a.innerText.trim();
    return t && t.length <= 80 && !reRuido.test(t);
  };

  let panel = descEl;
  let empresa = 'Desconocida';
  let empresa_visible = false;
  let nodo = descEl;
  while (nodo && nodo !== document.body) {
    const enlaces = [...nodo.querySelectorAll('a[href*="/company/"]')].filter(enlaceValido);
    const distintas = new Set(enlaces.map((a) => a.href.split('?')[0]));
    if (distintas.size > 2) break;
    panel = nodo;
    if (enlaces.length && !empresa_visible) {
      empresa = enlaces[0].innerText.trim();
      empresa_visible = true;
    }
    nodo = nodo.parentElement;
  }

  // 4. Cabecera, título y seguidores
  const cabecera = limpiar(panel.innerText).slice(0, 700);
  const tituloPestana = document.title || '';
  const tituloEl = document.querySelector('h1, [class*="job-title"], [class*="job-details"] h2');
  const titulo = (tituloEl && tituloEl.innerText.trim()) ||
                 tituloPestana.split('|')[0].trim() || 'Desconocido';
  const m = empresa_visible
    ? panel.innerText.match(/[\d.,]+\s*(seguidores|followers)/i)
    : null;

  // 5. Antigüedad y solicitudes (se busca fuera de la descripción para no confundirse con su texto)
  const textoPanel = panel.innerText.replace(descEl.innerText, '');
  const textoPagina = document.body.innerText;

  let publicada_meses = null;
  const ma = textoPanel.match(/hace\s+(\d+)\s+(mes|meses|a[nñ]o|a[nñ]os|semana|semanas|d[ií]a|d[ií]as)/i) ||
             textoPanel.match(/(\d+)\s+(month|months|year|years|week|weeks|day|days)\s+ago/i);
  if (ma) {
    const n = parseInt(ma[1], 10);
    const u = ma[2].toLowerCase();
    if (/^(mes|month)/.test(u)) publicada_meses = n;
    else if (/^(a|year)/.test(u)) publicada_meses = n * 12;
    else if (/^(semana|week)/.test(u)) publicada_meses = n / 4.345;
    else publicada_meses = n / 30;
  }

  let solicitudes = null;
  const ms = textoPanel.match(/(\d[\d.,]*)\s*(solicitudes|solicitantes|candidatos|applicants|applications)/i);
  if (ms) solicitudes = parseInt(ms[1].replace(/\D/g, ''), 10);

  // 6. Secciones de personas (su ausencia es una señal)
  const reEquipo = /conoce al equipo de contrataci[oó]n|meet the hiring team/i;
  const reContactos = /personas con las que (puedes|podr[ií]as) (hablar|contactar)|personas a las que puedes (contactar|escribir)|people you can (reach out to|talk to)|conecta con personas/i;
  const tiene_equipo_contratacion = reEquipo.test(textoPagina);
  const tiene_personas_contacto = reContactos.test(textoPagina);

  return {
    titulo, empresa, empresa_visible, descripcion,
    cabecera, titulo_pestana: tituloPestana,
    meta_empresa: m ? m[0] : '',
    publicada_meses, solicitudes,
    tiene_equipo_contratacion, tiene_personas_contacto
  };
}

/* ============================================================
   MODO EMPRESA: se ejecuta dentro de la página de la empresa
   ============================================================ */
function extraerEmpresa() {
  const texto = document.body.innerText;

  // Nombre: h1 o título de la pestaña, sin sufijos como ": Acerca de"
  const h1 = document.querySelector('h1');
  let nombre = (h1 && h1.innerText.trim()) || document.title || '';
  nombre = nombre.split('|')[0]
    .replace(/:\s*(acerca de|about|inicio|home|empleos|jobs|publicaciones|posts|personas|people)\s*$/i, '')
    .trim();

  // Página autogenerada por LinkedIn (nadie de la empresa la ha reclamado)
  const reAutogenerada = new RegExp(
    'p[aá]gina ha sido generada autom[aá]ticamente|' +
    'p[aá]gina no est[aá] avalada|' +
    'no est[aá] avalada, gestionada o asociada|' +
    'page was (automatically )?generated by linkedin|' +
    'page (is|has been) (automatically )?generated|' +
    'page is not (endorsed|managed|affiliated)|' +
    'not (endorsed|managed) (by|or) .{0,40}affiliated',
    'i'
  );
  const autogenerada = reAutogenerada.test(texto);

  const esLinkedin = (h) => /(^|\.)(linkedin\.com|licdn\.com|lnkd\.in)$/.test(h);
  const redes = /(^|\.)(facebook\.com|instagram\.com|twitter\.com|x\.com|youtube\.com|tiktok\.com|wa\.me|whatsapp\.com)$/;

  // Convierte un href o texto en hostname externo real (descifra los redirect de LinkedIn)
  const aHost = (s) => {
    try {
      let u = new URL(s, location.href);
      if (esLinkedin(u.hostname) && u.pathname.startsWith('/redir/redirect')) {
        const destino = u.searchParams.get('url');
        if (!destino) return null;
        u = new URL(destino);
      }
      if (!/^https?:$/.test(u.protocol)) return null;
      if (esLinkedin(u.hostname)) return null;
      return u.hostname;
    } catch (e) { return null; }
  };

  const reUrl = /https?:\/\/[^\s)<>"'\]]+/gi;
  const hostsEnTexto = (t) => {
    const res = [];
    for (const u of (t.match(reUrl) || [])) {
      const h = aHost(u.replace(/[.,;:]+$/, ''));
      if (h) res.push(h);
    }
    return res;
  };

  let web = null;
  let web_origen = null;

  // Intento 1: dentro del bloque de la etiqueta "Sitio web" / "Website"
  const etiquetas = [...document.querySelectorAll('*')].filter(
    (el) => el.children.length === 0 && /^(sitio web|website)$/i.test(el.textContent.trim())
  );
  for (const et of etiquetas) {
    let p = et;
    for (let i = 0; i < 5 && p && !web; i++, p = p.parentElement) {
      for (const a of p.querySelectorAll('a[href]')) {
        const h = aHost(a.href);
        if (h) { web = h; break; }
      }
      if (!web && p.innerText && p.innerText.length < 400) {
        const hs = hostsEnTexto(p.innerText);
        if (hs.length) web = hs[0];
      }
    }
    if (web) { web_origen = 'etiqueta'; break; }
  }

  // Intento 2: primera URL en el texto justo después de la etiqueta
  if (!web) {
    const idx = texto.search(/(sitio web|website)/i);
    if (idx >= 0) {
      const hs = hostsEnTexto(texto.slice(idx, idx + 300));
      if (hs.length) { web = hs[0]; web_origen = 'texto'; }
    }
  }

  // Intento 3 (último recurso): primer enlace externo de la página que no sea una red social
  if (!web) {
    for (const a of document.querySelectorAll('a[href]')) {
      const h = aHost(a.href);
      if (h && !redes.test(h)) { web = h; web_origen = 'enlace'; break; }
    }
  }

  const seg = texto.match(/([\d.,]+)\s*(seguidores|followers)/i);
  const emp = texto.match(/([\d.,]+(?:\s*[-–]\s*[\d.,]+)?\+?)\s*(empleados|employees)/i);
  const fund = texto.match(/(fundaci[oó]n|fundad[ao] en|founded)\s*:?\s*(\d{4})/i);

  return {
    nombre,
    web,
    web_origen,
    autogenerada,
    seguidores: seg ? parseInt(seg[1].replace(/\D/g, ''), 10) : null,
    empleados_txt: emp ? emp[1] : null,
    empleados_min: emp ? parseInt(emp[1].replace(/\./g, '').match(/\d+/)[0], 10) : null,
    fundacion: fund ? parseInt(fund[2], 10) : null
  };
}

/* ============================================================
   Utilidades del popup
   ============================================================ */
function mostrarEstado(mensaje) {
  document.getElementById('estado').textContent = mensaje;
}

function mostrarResultado(data) {
  const empresaEl = document.getElementById('empresa');
  if (empresaEl) empresaEl.textContent = data.etiqueta || '';

  const riesgoAlto = data.score_riesgo > 40;
  const color = riesgoAlto ? '#bd2130' : '#1e7e34';

  const score = document.getElementById('score');
  score.textContent = `${data.score_riesgo}%`;
  score.className = riesgoAlto ? 'riesgo' : 'ok';

  const barra = document.getElementById('barra');
  barra.style.width = `${data.score_riesgo}%`;
  barra.style.background = color;

  const lista = document.getElementById('alertas');
  lista.replaceChildren();
  const alertas = data.alertas.length ? data.alertas : ['Estructura e indicadores coherentes.'];
  alertas.forEach((a) => {
    const li = document.createElement('li');
    li.textContent = a;
    lista.appendChild(li);
  });

  document.getElementById('estado').style.display = 'none';
  document.getElementById('resultado').style.display = 'block';
}

// Antigüedad del dominio en días vía RDAP (sustituto moderno de WHOIS).
// Si el dominio no existe tal cual (p. ej. careers.empresa.com), prueba quitando subdominios.
async function edadDominio(host) {
  const partes = host.replace(/^www\./, '').split('.');
  while (partes.length >= 2) {
    try {
      const r = await fetch(`https://rdap.org/domain/${partes.join('.')}`);
      if (r.ok) {
        const j = await r.json();
        const ev = (j.events || []).find((e) => e.eventAction === 'registration');
        if (ev) return Math.floor((Date.now() - new Date(ev.eventDate)) / 86400000);
        return null;
      }
    } catch (e) { return null; }
    partes.shift();
  }
  return null;
}

/* ============================================================
   Flujos
   ============================================================ */
async function auditarOferta(tab) {
  const resultados = await chrome.scripting.executeScript({
    target: { tabId: tab.id, allFrames: true },
    func: extraerOferta
  });
  const oferta = resultados.map((r) => r.result).find((r) => r);

  if (!oferta) {
    mostrarEstado('No encuentro la descripción de la oferta. Abre una vacante concreta.');
    return;
  }

  const resp = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(oferta)
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

  const data = await resp.json();
  data.etiqueta = `Empresa detectada: ${oferta.empresa}`;
  mostrarResultado(data);
}

async function comprobarEmpresa(tab) {
  const resultados = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: extraerEmpresa
  });
  const e = resultados[0] && resultados[0].result;
  if (!e) {
    mostrarEstado('No se pudo leer la página de la empresa.');
    return;
  }

  let score = 0;
  const alertas = [];

  // Página autogenerada por LinkedIn
  if (e.autogenerada) {
    score += 40;
    alertas.push('Página autogenerada por LinkedIn: ningún representante la ha reclamado, así que cualquiera puede publicar ofertas a nombre de esta empresa.');
  }

  // Web oficial y antigüedad del dominio
  if (!e.web) {
    if (!e.autogenerada) {
      score += 25;
      alertas.push('No se encontró web oficial. Abre la pestaña "Acerca de" de la empresa y vuelve a pulsar el icono.');
    } else {
      alertas.push('Esta página no muestra web oficial, algo habitual en páginas autogeneradas.');
    }
  } else {
    if (e.web_origen === 'enlace') {
      alertas.push(`Web deducida de un enlace de la página (${e.web}). Verifica que es la oficial.`);
    }
    const dias = await edadDominio(e.web);
    if (dias === null) {
      alertas.push(`No se pudo comprobar la antigüedad de ${e.web} (RDAP no disponible para este dominio). No cuenta como señal.`);
    } else if (dias < 90) {
      score += 50;
      alertas.push(`Dominio web extremadamente nuevo (${dias} días). Peligro de suplantación.`);
    } else if (dias < 365) {
      score += 25;
      alertas.push(`Dominio web reciente (${dias} días).`);
    } else {
      alertas.push(`Dominio con ${Math.floor(dias / 365)} año(s) de antigüedad.`);
    }
  }

  // Huella en LinkedIn
  if (e.seguidores !== null && e.seguidores < 300) {
    score += 30;
    alertas.push(`Pocos seguidores en LinkedIn (${e.seguidores}).`);
  }
  if (e.empleados_min !== null && e.empleados_min <= 10) {
    score += 10;
    alertas.push(`Plantilla muy pequeña (${e.empleados_txt} empleados). Muchas empresas legítimas lo son, pero conviene verificarla.`);
  }
  const anio = new Date().getFullYear();
  if (e.fundacion !== null && e.fundacion >= anio - 1) {
    score += 20;
    alertas.push(`Empresa fundada recientemente (${e.fundacion}).`);
  }

  mostrarResultado({
    score_riesgo: Math.min(score, 100),
    alertas,
    etiqueta: `Empresa: ${e.nombre}${e.web ? ' · ' + e.web : ''}`
  });
}

async function auditar() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.url || !tab.url.includes('linkedin.com')) {
      mostrarEstado('Abre una oferta o la página de una empresa en LinkedIn y vuelve a pulsar el icono.');
      return;
    }

    if (/linkedin\.com\/company\//.test(tab.url)) {
      await comprobarEmpresa(tab);
    } else {
      await auditarOferta(tab);
    }
  } catch (err) {
    mostrarEstado('No se pudo completar la comprobación. Si estás en una oferta, ¿está ejecutándose app.py?');
    console.error(err);
  }
}

auditar();