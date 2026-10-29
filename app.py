from flask import Flask, request, jsonify
from flask_cors import CORS
import re
import requests
import whois
from datetime import datetime

app = Flask(__name__)
CORS(app)

PATRONES_GHOST_JOBS = {
    r"(bolsa de empleo|banco de talentos|futuras vacantes|pool vacancy|talent pool|future openings)": 35,
    r"(compartir (sus )?datos con terceros|compartir con socios|shared with third parties|shared with partners)": 40,
    r"(cv de respaldo|base de datos interna|guardaremos su cv|internal database|keep your (resume|cv))": 20
}

PATRONES_FRAUDE_PROCESO = {
    r"(urgente|contratacion inmediata|contratación inmediata|immediate start|urgent hiring)": 20,
    r"(sin entrevista|no entrevista t.cnica|no interview required|no technical interview)": 35,
    r"(descargar software|enlace externo obligatorio|download.*software|mandatory external link)": 45
}

PATRON_CONFIDENCIAL = r"(confidencial|confidential|an[oó]nim[oa]|stealth)"
PATRON_DESCRIPCION_OCULTA = (
    r"(empresa confidencial|confidential (company|employer|client)|"
    r"nuestro cliente,? (una )?(importante|prestigios|reconocid)|"
    r"no (podemos|se puede) (revelar|desvelar|indicar) (el nombre|la empresa))"
)


def consultar_phishtank(url_candidata):
    endpoint = "https://checkurl.phishtank.com/checkurl/"
    payload = {"url": url_candidata, "format": "json"}
    try:
        response = requests.post(
            endpoint, data=payload,
            headers={"User-Agent": "phishtank/linkedin-auditor"}, timeout=4
        )
        if response.status_code == 200:
            datos_api = response.json()
            if datos_api.get("results", {}).get("in_database", False):
                return True, datos_api["results"].get("valid", False)
    except Exception:
        pass
    return False, False


def obtener_edad_dominio(url):
    try:
        dominio = re.search(r'(?:https?://)?(?:www\.)?([^/]+)', url).group(1)
        info_registro = whois.whois(dominio)
        fecha_creacion = info_registro.creation_date
        if isinstance(fecha_creacion, list):
            fecha_creacion = fecha_creacion[0]
        if fecha_creacion:
            if fecha_creacion.tzinfo is not None:
                fecha_creacion = fecha_creacion.replace(tzinfo=None)
            return (datetime.now() - fecha_creacion).days
    except Exception:
        pass
    return None


def meses_publicada(texto):
    """Respaldo: meses desde la publicación leyendo la cabecera (0 si no se detecta)."""
    m = re.search(r"hace\s+(\d+)\s+(mes|meses|a[nñ]o|a[nñ]os)", texto)
    if m:
        n = int(m.group(1))
        return n * 12 if m.group(2).startswith("a") else n
    m = re.search(r"(\d+)\s+(month|months|year|years)\s+ago", texto)
    if m:
        n = int(m.group(1))
        return n * 12 if m.group(2).startswith("year") else n
    return 0


@app.route('/analizar', methods=['POST'])
def analizar():
    data = request.json or {}
    titulo = data.get('titulo', '').lower()
    empresa = data.get('empresa', '').lower().strip()
    descripcion = data.get('descripcion', '').lower()
    meta_empresa = data.get('meta_empresa', '').lower()
    cabecera = data.get('cabecera', '').lower()
    titulo_pestana = data.get('titulo_pestana', '').lower()
    empresa_visible = data.get('empresa_visible', True)

    # Nuevos datos de la página
    meses_js = data.get('publicada_meses')
    meses = float(meses_js) if meses_js is not None else meses_publicada(cabecera)
    solicitudes = data.get('solicitudes')
    tiene_equipo = data.get('tiene_equipo_contratacion', True)
    tiene_contactos = data.get('tiene_personas_contacto', True)

    score_riesgo = 0
    alertas = []

    es_sector_critico = any(x in titulo or x in descripcion for x in [
        "tech", "developer", "engineer", "data", "banco", "banking",
        "finance", "fintech", "software", "desarrollador"
    ])

    # A. Empleador oculto o confidencial
    zona_empresa = f"{empresa} {titulo_pestana} {cabecera[:500]}"
    if (re.search(PATRON_CONFIDENCIAL, zona_empresa)
            or not empresa_visible
            or empresa in ("", "desconocida")):
        score_riesgo += 45
        alertas.append("Empleador oculto o confidencial: no se puede verificar la empresa")
    elif re.search(PATRON_DESCRIPCION_OCULTA, descripcion):
        score_riesgo += 35
        alertas.append("La descripción oculta la identidad de la empresa contratante")

    # B. Antigüedad + solicitudes (oferta fantasma)
    muchas_solicitudes = solicitudes is not None and solicitudes >= 100
    if meses >= 6 and muchas_solicitudes:
        score_riesgo += 35
        alertas.append(f"Oferta abierta desde hace {round(meses)} meses con {solicitudes}+ solicitudes: posible oferta fantasma")
    elif meses >= 4 and muchas_solicitudes:
        score_riesgo += 20
        alertas.append(f"Oferta abierta desde hace {round(meses)} meses con {solicitudes}+ solicitudes")
        if not tiene_equipo:
            score_riesgo += 15
            alertas.append("Más de 4 meses, 100+ solicitudes y sin ninguna persona de contratación visible")
    elif meses >= 1:
        score_riesgo += 10
        alertas.append(f"Oferta publicada hace {round(meses)} mes(es): posible oferta fantasma")

    # C. Ausencia de personas reales en la oferta
    if not tiene_equipo:
        score_riesgo += 10
        alertas.append("No aparece el equipo de contratación (ningún reclutador identificado)")
    if not tiene_contactos:
        score_riesgo += 10
        alertas.append("LinkedIn no sugiere personas con las que hablar: sin empleados o ex-empleados visibles")

    # D. Condiciones demasiado buenas / genéricas
    senales = [
        r"100\s?%\s*(remot|teletrabajo)|totalmente remot|full(y)? remote",
        r"cualquier (punto|lugar|parte) de espa[nñ]a|desde cualquier lugar|from anywhere",
        r"contrato indefinido",
        r"retribuci[oó]n flexible|seguro m[eé]dico",
        r"proyecto tecnol[oó]gico en crecimiento|plan de desarrollo profesional",
    ]
    if sum(1 for p in senales if re.search(p, descripcion)) >= 3:
        score_riesgo += 25
        alertas.append("Condiciones muy atractivas y genéricas, sin detalles concretos del puesto")

    # E. Patrones lingüísticos
    for patron, pen in PATRONES_GHOST_JOBS.items():
        if re.search(patron, descripcion):
            score_riesgo += pen
            alertas.append("Patrón detectado: Recolección masiva de datos / Ghost Job")

    for patron, pen in PATRONES_FRAUDE_PROCESO.items():
        if re.search(patron, descripcion):
            score_riesgo += pen
            alertas.append("Patrón detectado: Proceso de selección atípico para IT/Banca")

    # F. Seguidores
    if es_sector_critico and ("seguidor" in meta_empresa or "follower" in meta_empresa):
        m = re.search(r'([\d.,]+)\s*(seguidor|follower)', meta_empresa)
        if m:
            digitos = re.sub(r'\D', '', m.group(1))
            if digitos and int(digitos) < 300:
                score_riesgo += 40
                alertas.append(f"Infraestructura corporativa débil (solo {int(digitos)} seguidores)")

    # G. Enlaces
    for url in re.findall(r'(https?://[^\s]+)', descripcion):
        url_limpia = url.strip('.,()[]{}')

        esta_en_db, es_phishing = consultar_phishtank(url_limpia)
        if esta_en_db and es_phishing:
            score_riesgo += 60
            alertas.append("¡ENLACE MALICIOSO REPORTADO EN PHISHTANK!")
            continue

        dias = obtener_edad_dominio(url_limpia)
        if dias is not None and dias < 90:
            score_riesgo += 50
            alertas.append(f"Dominio web extremadamente nuevo ({dias} días). Peligro de suplantación.")

        if re.search(r'(bit\.ly|tinyurl\.com|t\.me|forms\.gle)', url_limpia):
            score_riesgo += 25
            alertas.append("Usa enlaces acortados o formularios externos")

    score_riesgo = min(score_riesgo, 100)
    return jsonify({"score_riesgo": score_riesgo, "alertas": list(set(alertas))})


if __name__ == '__main__':
    app.run(host='127.0.0.1', port=5000, debug=True)