# 🛡️ LinkedIn Job Fraud Auditor / Auditor de Fraude Laboral

 An OSINT-driven, privacy-focused browser extension powered by a cloud-deployed Python backend (Render). Designed to detect sophisticated job scams, data harvesting, and phishing in IT and banking sectors on LinkedIn.
 Una extensión de navegador y backend en Python desplegado en la nube (Render) basados en OSINT y enfocados en la privacidad. Diseñados para detectar estafas laborales sofisticadas, recolección masiva de datos y phishing en los sectores de IT y banca en LinkedIn.

---

## 🌍 English Presentation

### 🚀 About the Project
Job scams in technology and banking sectors have evolved beyond simple phishing. Threat actors now orchestrate advanced corporate identity theft, deploying "Ghost Jobs" to farm massive amounts of personal data (CVs, IDs, banking information) or delivering malware under the guise of technical tests.

This project offers an **autonomously connected, passive auditing system**. The frontend browser extension extracts metadata from LinkedIn job postings and queries a production-ready, cloud-hosted Python analytical engine on **Render**, removing any local environment setup for the end-user.

### 🔬 Core Features & Research Base
The analytical engine is built upon empirical telemetry and OSINT methodologies reported in recent global threat intelligence investigations:
*   **Bilingual Heuristic Engine (ES/EN):** Intercepts data-farming patterns, premature sensitive document requests, and anomalous selection processes.
*   **RDAP Infrastructure Audit:** Queries the global `rdap.org` bootstrap server to calculate domain registration age in milliseconds. If a domain is younger than 90 days, the risk score escalates.
*   **PhishTank Integration:** Cross-references embedded shorteners or URLs with live phishing threat feeds.
*   **Anonymity by Design (OSINT Principle):** Queries are aggregated at the network/TLD level; your individual research profile remains untraceable to attackers.
*   **No False Positives Policy:** If a specific ccTLD or domain registry suppresses creation event times under RDAP, the tool explicitly states it as a non-risky informative warning rather than throwing a false alarm.

---

## 🇪🇸 Presentación en Español

### 🚀 Sobre el Proyecto
Las estafas de empleo en los sectores tecnológico y bancario han evolucionado más allá del phishing común. Los atacantes ahora orquestan suplantaciones de identidad corporativa avanzadas, desplegando "Vacantes Fantasma" (*Ghost Jobs*) para recolectar masivamente datos personales (CVs, DNI/NIE, información bancaria) o distribuir malware bajo el pretexto de pruebas técnicas.

Este proyecto ofrece un **sistema de auditoría pasiva autónomo**. La extensión de navegador frontend extrae los metadatos de las ofertas de LinkedIn e interroga de forma directa a un motor analítico en Python alojado en la nube (**Render**), eliminando la necesidad de que el usuario final configure entornos locales.

### 🔬 Características Clave y Base de Investigación
El motor analítico se basa en telemetría empírica y metodologías OSINT documentadas en investigaciones recientes de inteligencia de amenazas:
*   **Motor Heurístico Bilingüe (ES/EN):** Intercepta patrones de *Data Farming*, solicitudes prematuras de documentación confidencial y procesos de selección atípicos.
*   **Auditoría de Infraestructura RDAP:** Interroga el servidor bootstrap global de `rdap.org` para calcular la antigüedad del dominio. Si tiene menos de 90 días de vida, el riesgo se dispara.
*   **Integración con PhishTank:** Contraste en tiempo real de enlaces acortados o URLs con bases de datos globales de phishing.
*   **Anonimato por Diseño (Principio OSINT):** Las consultas se agregan a nivel de subred/TLD; el perfil de investigación del usuario permanece oculto para los atacantes.
*   **Política de Cero Falsos Positivos:** Si un registro de dominio oculta las fechas de creación bajo RDAP, la herramienta lo reporta de manera transparente de forma informativa sin inventar un riesgo.

---

## 🛠️ Tech Stack / Tecnologías Utilizadas

*   **Frontend (The "Eye" / El "Ojo"):** Browser WebExtension Architecture (**Manifest V3**). JavaScript (HTML5/CSS3). Compatible with Chromium (Chrome, Brave, Edge, Opera, Vivaldi) & Mozilla Firefox (Gecko).
*   **Backend (The "Brain" / El "Cerebro"):** Python 3.x, Flask (Microframework), Gunicorn (Production WSGI server), Requests (HTTP client), Native HTTP RDAP Client. **Hosted on Render Cloud**.

---

## 🚀 Installation & Deployment / Instalación y Despliegue

### 1. Backend Cloud Deployment / Despliegue del Servidor en la Nube (Render)
To host your own analytical engine / Para alojar tu propio motor analítico:
1. Push this repository to **GitHub**.
2. Create a free account on **Render.com**.
3. Select **New ➔ Web Service** and connect your GitHub repository.
4. Set the following environment configurations / Define la configuración de entorno:
   * **Runtime:** `Python`
   * **Build Command:** `pip install -r requirements.txt`
   * **Start Command:** `gunicorn app:app`

### 2. Frontend Setup / Configuración de la Extensión (Browser)
1. Open `popup.js` and update the `fetch()` URL from `127.0.0.1` to your public Render URL (`https://onrender.com`).
2. Open your browser and navigate to the extensions panel (e.g., `chrome://extensions/` or `about:debugging` in Firefox).
3. Enable **Developer Mode** / Activa el **Modo de desarrollador**.
4. Click on **Load Unpacked** and select the `/linkedin-auditor-extension` subdirectory.
5. Open any job position on LinkedIn, click the extension icon on your toolbar, and hit **"Analizar Oferta Actual"**.

1. Abre `popup.js` y actualiza la URL del `fetch()` cambiando el `127.0.0.1` por tu URL pública de Render (`https://onrender.com`).
2. Abre tu navegador y ve al panel de extensiones (ej. `chrome://extensions/` o `about:debugging` en Firefox).
3. Activa el **Modo de desarrollador**.
4. Haz clic en **Cargar desempaquetada** y selecciona la subcarpeta `/linkedin-auditor-extension`.
5. Abre cualquier oferta en LinkedIn, haz clic en el icono de la extensión y presiona **"Analizar Oferta Actual"**.

---

## ⚖️ License & Disclaimer / Licencia y Descargo de Responsabilidad

Distributed under the **MIT License**. This tool is an informational aid designed to reduce uncertainty through public infrastructure analysis; however, cybersecurity defense layers mitigate risk but do not entirely eliminate human-targeted social engineering.

Distribuido bajo la **Licencia MIT**. Esta herramienta es una ayuda informativa diseñada para reducir la incertidumbre mediante el análisis de infraestructura pública; sin embargo, las capas de defensa en ciberseguridad mitigan el riesgo pero no eliminan por completo la ingeniería social dirigida.
