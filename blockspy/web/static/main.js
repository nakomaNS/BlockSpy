document.addEventListener('DOMContentLoaded', async () => {
    let translations = {};
    let currentLangCode = 'pt';
    async function loadTranslations(lang) {
    try {
        const response = await fetch(`/static/locales/${lang}.json`);
        if (!response.ok) throw new Error('Dicionário não encontrado');
        translations = await response.json();
    } catch (error) {
        console.error(`Falha ao carregar traduções para '${lang}', usando 'en' como padrão.`, error);
        const response = await fetch(`/static/locales/en.json`);
        translations = await response.json();
    }
}

// Encontra todos os elementos marcados e aplica a tradução
function translatePage() {
    document.querySelectorAll('[data-i18n-key]').forEach(element => {
        const key = element.getAttribute('data-i18n-key');
        if (translations[key]) {
            
            // ---- INÍCIO DA CORREÇÃO ----
            // Verifica se o alvo da tradução é um atributo (ex: placeholder)
            const targetAttr = element.getAttribute('data-i18n-target');
            
            if (targetAttr) {
                // Se for um atributo, usa setAttribute para mudá-lo
                element.setAttribute(targetAttr, translations[key]);
            } else {
                // Senão, faz o que já fazia: muda o conteúdo de texto
                const textNode = element.childNodes[element.childNodes.length - 1];
                if (textNode && textNode.nodeType === Node.TEXT_NODE) {
                    textNode.textContent = ' ' + translations[key];
                }
            }
        }
    });
}

function updateDynamicContent() {
    // Por enquanto, ela só precisa repopular os filtros
    if (typeof populateFilters === 'function') {
        populateFilters();
    }
    // No futuro, se tiver outros conteúdos dinâmicos, adicione-os aqui
}

// Função principal para trocar o idioma
async function setLanguage(lang) {
    currentLangCode = lang;
    await loadTranslations(lang);
    translatePage();
    updateDynamicContent();
    localStorage.setItem('language', lang);

    const ptBtn = document.getElementById('lang-pt-btn');
    const enBtn = document.getElementById('lang-en-btn');
    if (ptBtn && enBtn) {
        if (lang === 'pt') {
            ptBtn.classList.add('active');
            enBtn.classList.remove('active');
        } else {
            enBtn.classList.add('active');
            ptBtn.classList.remove('active');
        }
    }


}
    Chart.register(ChartZoom);

    // --- LÓGICA DO MODAL DE CONFIRMAÇÃO ---
    const confirmModal = document.getElementById('custom-modal');
    const confirmModalTitle = document.getElementById('modal-title');
    const confirmModalMessage = document.getElementById('modal-message');
    const confirmModalBtnConfirm = document.getElementById('modal-btn-confirm');
    const confirmModalBtnCancel = document.getElementById('modal-btn-cancel');
    let confirmCallback = null;

    

    function showConfirmModal(title, message, onConfirm) {
        if (!confirmModal) return;
        confirmModalTitle.textContent = title;
        confirmModalMessage.textContent = message;
        confirmCallback = onConfirm;
        confirmModal.classList.add('visible');
    }
    function parseVersion(versionString) {
    if (!versionString) return { flavor: null, baseVersion: null };
    const versionMatch = versionString.match(/\d+(\.\d+)+/);
    const baseVersion = versionMatch ? versionMatch[0] : null;

    let flavor = "Vanilla";
    if (baseVersion) {
        const flavorCandidate = versionString.replace(baseVersion, '').replace(/[()]/g, '').trim();
        if (flavorCandidate) {
            flavor = flavorCandidate.split(' ')[0];
        }
    } else {
        flavor = versionString.split(' ')[0];
    }
    return { flavor, baseVersion };
}
    function updateConsoleUI(isConfigured, serverObject) {
    const overlay = document.getElementById('console-overlay');
    const output = document.getElementById('console-log-display');
    const inputArea = document.querySelector('.console-input-area');
    const configureBtn = document.getElementById('console-configure-btn');

    if (isConfigured) {
        // Se ESTÁ configurado: esconde o overlay e inicia o console
        overlay.classList.remove('visible');
        output.style.opacity = 1;
        inputArea.style.opacity = 1;
        setupConsole(serverObject.ip_servidor); // Inicia a conexão WebSocket
    } else {
        // Se NÃO ESTÁ configurado: mostra o overlay e bloqueia o console
        overlay.classList.add('visible');
        output.style.opacity = 0.1; // Deixa o fundo do console quase invisível
        inputArea.style.opacity = 0.1;

        // Adiciona o evento ao botão para abrir o modal de edição
        configureBtn.onclick = () => {
            showEditModal(serverObject.ip_servidor);
        };
    }
}
    function hideConfirmModal() {
        if (!confirmModal) return;
        confirmModal.classList.remove('visible');
        confirmCallback = null;
    }

    if (confirmModal) {
        confirmModalBtnConfirm.addEventListener('click', () => { if (confirmCallback) { confirmCallback(); } hideConfirmModal(); });
        confirmModalBtnCancel.addEventListener('click', hideConfirmModal);
        confirmModal.addEventListener('click', (e) => { if (e.target === confirmModal) { hideConfirmModal(); } });
    }

    // --- ELEMENTOS GERAIS E DE NAVEGAÇÃO ---
    const serverListContainer = document.getElementById('server-list');
    const UPDATE_INTERVAL = 20000;
    const DETAILS_UPDATE_INTERVAL = 20000;
    let allServersCache = [];
    let currentOpenServer = null;
    let historyChart = null;
    let heatmapChart = null;
    let consoleSocket = null;
    let updateIntervalId = null; 
    let detailsUpdateIntervalId = null;
    let lastHistoryData = null;

    function formatServerType(type) {
    const originalIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent-green)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path><path d="m9 12 2 2 4-4"></path></svg>`;
    const pirataIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent-red)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 9.9-1"></path></svg>`;

    // Monta a chave de tradução, ex: "server_type_Original"
    const translationKey = `server_type_${type}`;
    // Busca a tradução. Se não encontrar, usa o tipo original.
    const translatedType = translations[translationKey] || type;

    if (type === 'Original') {
        return `${originalIcon} ${translatedType}`;
    }
    if (type === 'Pirata') {
        return `${pirataIcon} ${translatedType}`;
    }
    return translatedType; // Para "Indefinido", "Lista Oculta", etc.
}

    const playerTooltip = document.createElement('div');
    playerTooltip.className = 'player-tooltip';
    document.body.appendChild(playerTooltip);
    const heatmapTooltip = document.createElement('div');
    heatmapTooltip.className = 'heatmap-tooltip';
    document.body.appendChild(heatmapTooltip);
    const views = {
        'dashboard': document.getElementById('dashboard-view'),
        'add-server': document.getElementById('add-server-view'),
        'settings': document.getElementById('settings-view'),
        'details': document.getElementById('details-view')
    };
    const navButtons = {
        'dashboard': document.getElementById('nav-dashboard'),
        'add-server': document.getElementById('nav-add-server'),
        'settings': document.getElementById('nav-settings')
    };
    
    const appCache = {
        db: null, dbName: 'BlockSpyIconCache', storeName: 'icons',
        async init() {
            return new Promise((resolve, reject) => {
                if (!window.indexedDB) { console.warn("IndexedDB não é suportado."); return resolve(); }
                const request = indexedDB.open(this.dbName, 1);
                request.onerror = (e) => reject(`Erro no IndexedDB: ${e.target.errorCode}`);
                request.onsuccess = (e) => { this.db = e.target.result; console.log("Cache de ícones iniciado."); resolve(); };
                request.onupgradeneeded = (e) => {
                    const db = e.target.result;
                    if (!db.objectStoreNames.contains(this.storeName)) { db.createObjectStore(this.storeName); }
                };
            });
        },
        async get(key) {
            return new Promise((resolve) => {
                if (!this.db) return resolve(null);
                const request = this.db.transaction([this.storeName], 'readonly').objectStore(this.storeName).get(key);
                request.onerror = () => resolve(null);
                request.onsuccess = () => resolve(request.result);
            });
        },
        async set(key, value) {
            return new Promise((resolve, reject) => {
                if (!this.db) return reject("DB não iniciado.");
                const request = this.db.transaction([this.storeName], 'readwrite').objectStore(this.storeName).put(value, key);
                request.onerror = () => reject("Falha ao salvar no cache.");
                request.onsuccess = () => resolve();
            });
        }
    };
    
    function playIconSVG() { return `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>`; }
    function pauseIconSVG() { return `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>`; }
    function removeIconSVG() { return `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>`; }
    function editIconSVG() { return `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>`; }

    function setupNavigation() {
        window.showView = (viewId) => {
            if (viewId !== 'details') {
                clearInterval(detailsUpdateIntervalId);
                detailsUpdateIntervalId = null;
                if(historyChart) {
                    historyChart.destroy();
                    historyChart = null;
                }
                if(heatmapChart) {
                    heatmapChart.destroy();
                    heatmapChart = null;
                }
            }
            Object.values(views).forEach(view => { if (view) view.style.display = 'none'; });
            Object.values(navButtons).forEach(button => { if (button) button.classList.remove('active'); });
            if (views[viewId]) {
                views[viewId].style.display = 'block';
                const navKey = viewId === 'details' ? 'dashboard' : viewId;
                if (navButtons[navKey]) { navButtons[navKey].classList.add('active'); }
            }
        };
        Object.keys(navButtons).forEach(key => { if (navButtons[key]) { navButtons[key].addEventListener('click', (e) => { e.preventDefault(); window.showView(key); }); } });
        const backButton = document.getElementById('back-to-dashboard');
        if (backButton) { backButton.addEventListener('click', (e) => { e.preventDefault(); window.showView('dashboard'); }); }
        window.showView('dashboard');
    }

    function setupTheme() {
    const darkBtn = document.getElementById('theme-btn-dark');
    const lightBtn = document.getElementById('theme-btn-light');
    const videoDark = document.getElementById('video-dark');
    const videoLight = document.getElementById('video-light');

    function applyTheme(theme) {
        document.body.classList.toggle('light-mode', theme === 'light');
        if (videoDark) videoDark.style.opacity = (theme === 'light' ? '0' : '1');
        if (videoLight) videoLight.style.opacity = (theme === 'light' ? '1' : '0');

        // Atualiza a classe .active nos botões
        if (darkBtn && lightBtn) {
            if (theme === 'light') {
                lightBtn.classList.add('active');
                darkBtn.classList.remove('active');
            } else {
                darkBtn.classList.add('active');
                lightBtn.classList.remove('active');
            }
        }
        
        // Redesenha o gráfico se ele estiver visível
        if (historyChart && lastHistoryData && views['details'].style.display === 'block') {
            if(historyChart) historyChart.destroy();
            historyChart = null;
            renderHistoryChart(lastHistoryData);
        }
    }

    // Adiciona os eventos de clique aos novos botões
    if (darkBtn) {
        darkBtn.addEventListener('click', () => {
            localStorage.setItem('theme', 'dark');
            applyTheme('dark');
        });
    }
    if (lightBtn) {
        lightBtn.addEventListener('click', () => {
            localStorage.setItem('theme', 'light');
            applyTheme('light');
        });
    }

    // Aplica o tema salvo ao iniciar
    const savedTheme = localStorage.getItem('theme') || 'dark';
    applyTheme(savedTheme);
}
    function populateFilters() {
    if (!allServersCache.length) return;

    const flavorFilter = document.getElementById('filter-flavor');
    const baseVersionFilter = document.getElementById('filter-base-version');
    const typeFilter = document.getElementById('filter-type');

    const flavors = new Set();
    const baseVersions = new Set();
    const types = new Set();

    allServersCache.forEach(server => {
        const { flavor, baseVersion } = parseVersion(server.versao);
        if (flavor) flavors.add(flavor);
        if (baseVersion) baseVersions.add(baseVersion);
        if (server.tipo_servidor) types.add(server.tipo_servidor);
    });

    const sortedFlavors = [...flavors].sort();
    const sortedBaseVersions = [...baseVersions].sort().reverse();
    const sortedTypes = [...types].sort();

    const selectedFlavor = flavorFilter.value;
    const selectedBaseVersion = baseVersionFilter.value;
    const selectedType = typeFilter.value;

    flavorFilter.innerHTML = `<option value="">${translations.filter_option_all_servers || 'Todos'}</option>`;
    baseVersionFilter.innerHTML = `<option value="">${translations.filter_option_all_versions || 'Todas'}</option>`;
    typeFilter.innerHTML = `<option value="">${translations.filter_option_all_servers || 'Todos'}</option>`;

    sortedFlavors.forEach(flavor => flavorFilter.add(new Option(flavor, flavor)));
    sortedBaseVersions.forEach(version => baseVersionFilter.add(new Option(version, version)));
    sortedTypes.forEach(type => {
    // Montamos a chave que está no nosso dicionário JSON. Ex: "server_type_Original"
    const translationKey = `server_type_${type}`;

    // Procuramos a tradução. Se não achar, usamos o texto original como segurança.
    const translatedText = translations[translationKey] || type;

    // Criamos a opção usando o texto traduzido para o que o usuário vê,
    // mas mantendo o valor original para o filtro funcionar.
    typeFilter.add(new Option(translatedText, type));
});

    flavorFilter.value = selectedFlavor;
    baseVersionFilter.value = selectedBaseVersion;
    typeFilter.value = selectedType;
}
    function renderMotdInElement(motdString, containerElement) {
        containerElement.innerHTML = '';
        if (!motdString) {
            containerElement.textContent = 'Servidor sem nome';
            return;
        }
        const colorMap = {
            '0': '0', '1': '1', '2': '2', '3': '3', '4': '4', '5': '5', '6': '6', '7': '7', 
            '8': '8', '9': '9', 'a': 'a', 'b': 'b', 'c': 'c', 'd': 'd', 'e': 'e', 'f': 'f'
        };
        const formatMap = { 'l': 'l', 'o': 'o', 'n': 'n', 'm': 'm' };
        const lines = motdString.split('\n');
        lines.forEach((line, lineIndex) => {
            const trimmedLine = line.trim();
            const parts = trimmedLine.split('§');
            let currentFormats = new Set();
            let currentColorClass = 'mc-color-f';
            const firstPart = parts.shift();
            if (firstPart) {
                const span = document.createElement('span');
                span.textContent = firstPart;
                span.className = currentColorClass;
                containerElement.appendChild(span);
            }
            parts.forEach(part => {
                if (part.length === 0) return;
                const code = part[0].toLowerCase();
                const text = part.substring(1);
                if (colorMap[code]) {
                    currentFormats.clear();
                    currentColorClass = `mc-color-${colorMap[code]}`;
                } else if (formatMap[code]) {
                    currentFormats.add(`mc-format-${formatMap[code]}`);
                } else if (code === 'r') {
                    currentFormats.clear();
                    currentColorClass = 'mc-color-f';
                }
                if (text) {
                    const span = document.createElement('span');
                    span.textContent = text;
                    span.className = [currentColorClass, ...currentFormats].join(' ');
                    containerElement.appendChild(span);
                }
            });
            if (lineIndex < lines.length - 1) {
                containerElement.appendChild(document.createElement('br'));
            }
        });
    }

    function renderServerList(servers) {
    if (!serverListContainer) return;
    const preservedScroll = serverListContainer.scrollTop;
    serverListContainer.innerHTML = '';
    if (!servers || servers.length === 0) {
        serverListContainer.innerHTML = '<p class="empty-message">Nenhum servidor para exibir. Adicione um na aba "Add Server".</p>';
        return;
    }

    servers.forEach(server => {
        const card = document.createElement('div');
        card.className = 'server-card';
        card.dataset.ip = server.ip_servidor;
        let statusText, statusClass;
        const isOnline = server.status === 'online' && !server.pausado;

        if (server.pausado) {
            statusText = translations.card_status_paused || 'Pausado';
            statusClass = 'paused';
            card.classList.add('paused');
        } else if (isOnline) {
            statusText = translations.card_status_online || 'Online';
            statusClass = 'online';
            card.classList.remove('offline');
        } else if (server.status === 'pending') {
            statusText = translations.card_status_checking || 'Verificando...';
            statusClass = 'paused';
            card.classList.add('offline');
        } else {
            statusText = translations.card_status_offline || 'Offline';
            statusClass = 'offline';
            card.classList.add('offline');
        }

        const displayName = server.nome_customizado || server.nome_servidor || server.ip_servidor;
        const iconHTML = (server.tem_icone_customizado == 1)
            ? `<div class="server-icon" data-lazy-type="icon" data-ip="${server.ip_servidor}"><span>${(displayName || '?').replace(/§[0-9a-fk-or]/gi, '').charAt(0).toUpperCase()}</span></div>`
            : `<div class="server-icon" data-ip="${server.ip_servidor}"><img src="/static/grass.png" alt="Ícone padrão"></div>`;

        const flagImg = server.country_code ? `<img src="https://flagcdn.com/w20/${server.country_code.toLowerCase()}.png" alt="${server.localizacao}" class="flag-icon">` : '';
        const locationText = server.localizacao || (translations.card_location_fetching || 'Buscando...');
        const locationHTML = `<span>${flagImg} ${locationText}</span>`;

        // ---- TRADUÇÃO DOS TOOLTIPS ACONTECE AQUI ----
        const editTitle = translations.card_tooltip_edit || 'Editar';
        const pauseTitle = server.pausado ? (translations.card_tooltip_resume || 'Reativar') : (translations.card_tooltip_pause || 'Pausar');
        const removeTitle = translations.card_tooltip_remove || 'Remover';

        card.innerHTML = `
            <div class="card-header">
                <div class="server-icon-and-details">
                    ${iconHTML}
                    <div class="server-details">
                        <h3></h3> 
                        <p>${server.ip_servidor}</p>
                    </div>
                </div>
                <div class="card-actions">
                    <button class="card-action-btn edit-btn" title="${editTitle}" data-ip="${server.ip_servidor}" data-action="edit">${editIconSVG()}</button>
                    <button class="card-action-btn pause-btn" title="${pauseTitle}" data-ip="${server.ip_servidor}" data-action="pause">${server.pausado ? playIconSVG() : pauseIconSVG()}</button>
                    <button class="card-action-btn delete-btn" title="${removeTitle}" data-ip="${server.ip_servidor}" data-action="delete">${removeIconSVG()}</button>
                </div>
            </div>
            <div class="player-info">
                <span>Ping: ${isOnline ? server.ping + 'ms' : '--'}</span>
                <span class="status-badge ${statusClass}">${statusText}</span>
            </div>
            <div class="info-details">
                 <div class="info-row"><span data-i18n-key="card_label_type">Tipo:</span><span>${formatServerType(server.tipo_servidor)}</span></div>
                 <div class="info-row"><span data-i18n-key="card_label_players">Jogadores:</span><span>${isOnline ? `${server.jogadores_online} / ${server.jogadores_maximos}` : '--'}</span></div>
                 <div class="info-row"><span data-i18n-key="card_label_version">Versão:</span><span>${isOnline ? server.versao : '--'}</span></div>
                 <div class="info-row"><span data-i18n-key="card_label_location">Local:</span>${locationHTML}</div>
            </div>`;

        const motdContainer = card.querySelector('.server-details h3');
        renderMotdInElement(displayName, motdContainer);
        
        serverListContainer.appendChild(card);
    });
    
    setupIntersectionObserver();
    serverListContainer.scrollTop = preservedScroll;
    translatePage();
}
let intersectionObserver = null;
function setupIntersectionObserver() {
    const lazyElements = document.querySelectorAll('[data-lazy-type="icon"]');
    if (intersectionObserver) intersectionObserver.disconnect();
    
    intersectionObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const element = entry.target;
                loadIcon(element);
                observer.unobserve(element);
            }
        });
    }, { rootMargin: "200px" });

    lazyElements.forEach(el => intersectionObserver.observe(el));
}

    // Função para gerenciar o console ao vivo
function setupConsole(serverIp) {
    if (consoleSocket) {
        consoleSocket.close(); // Fecha qualquer conexão antiga
    }
    
    const logDisplay = document.getElementById('console-log-display');
    const commandInput = document.getElementById('rcon-command-input');
    const consoleTitle = document.querySelector('.card-console h2');
    if (!logDisplay || !commandInput || !consoleTitle) return;

    logDisplay.innerHTML = ''; // Limpa o console antigo
    const connectingLine = document.createElement('div');
    connectingLine.className = 'log-status';
    // --- TRADUZIDO ---
    connectingLine.textContent = translations.console_connecting || 'Conectando ao console do servidor...';
    logDisplay.appendChild(connectingLine);

    const wsProtocol = window.location.protocol === 'https' ? 'wss' : 'ws';
    const wsUrl = `${wsProtocol}://${window.location.host}/ws/console/${serverIp}`;
    
    consoleSocket = new WebSocket(wsUrl);

    consoleSocket.onopen = () => {
        console.log('Conexão WebSocket estabelecida.');
    };

    consoleSocket.onmessage = (event) => {
        if (logDisplay.textContent.includes(translations.console_connecting || 'Conectando ao console')) {
            logDisplay.innerHTML = '';
        }
        
        const msg = JSON.parse(event.data);
        const logLine = document.createElement('div');
        logLine.textContent = msg.data;

        switch (msg.type) {
            case 'status':
                logLine.className = 'log-status';
                if (msg.data.includes('ao vivo')) {
                    // --- TRADUZIDO ---
                    consoleTitle.innerHTML = translations.console_title_live || '🔴 Console ao Vivo';
                } else if (msg.data.includes('RCON')) {
                    // --- TRADUZIDO ---
                    consoleTitle.innerHTML = translations.console_title_rcon || '📟 Console RCON';
                }
                break;
            case 'log':
                logLine.className = 'log-line';
                if (msg.data.includes('<') && msg.data.includes('>')) {
                    logLine.classList.add('log-chat');
                }
                break;
            case 'rcon_sent':
                logLine.className = 'log-rcon-sent';
                break;
            case 'rcon_response':
                logLine.className = 'log-rcon-response';
                if (msg.data.toLowerCase().startsWith('< erro')) {
                    logLine.classList.add('log-error');
                }
                break;
            default:
                logLine.className = 'log-line';
        }
        
        logDisplay.appendChild(logLine);
        logDisplay.scrollTop = logDisplay.scrollHeight;
    };

    consoleSocket.onclose = () => {
        console.log('Conexão WebSocket fechada.');
        const logLine = document.createElement('div');
        logLine.className = 'log-status log-error';
        logLine.textContent = '';
        logDisplay.appendChild(logLine);
        logDisplay.scrollTop = logDisplay.scrollHeight;
        // --- TRADUZIDO ---
        consoleTitle.innerHTML = translations.console_title_disconnected || '🔌 Console Desconectado';
    };

    commandInput.onkeydown = (event) => {
        if (event.key === 'Enter') {
            const command = commandInput.value;
            if (command && consoleSocket.readyState === WebSocket.OPEN) {
                consoleSocket.send(command);
                commandInput.value = '';
            }
        }
    };
}
    async function loadIcon(iconContainer) {
        const ip = iconContainer.dataset.ip;
        if (!ip) return;
        const cachedBlob = await appCache.get(ip);
        if (cachedBlob) { const url = URL.createObjectURL(cachedBlob); const img = new Image(); img.src = url; img.onload = () => { iconContainer.innerHTML = ''; iconContainer.appendChild(img); URL.revokeObjectURL(url); }; return; }
        try {
            const response = await fetch(`/api/icon/${ip}`);
            if (!response.ok) throw new Error('Proxy falhou.');
            const blob = await response.blob();
            await appCache.set(ip, blob);
            const url = URL.createObjectURL(blob);
            const img = new Image(); img.src = url; img.onload = () => { iconContainer.innerHTML = ''; iconContainer.appendChild(img); URL.revokeObjectURL(url); };
        } catch (error) { console.error(`Falha ao carregar ícone para ${ip}:`, error); }
    }

    async function fetchAndUpdateServers() {
    try {
        const response = await fetch('/api/servers');
        if (!response.ok) { throw new Error(`API falhou com status ${response.status}`); }
        allServersCache = await response.json();
        
        populateFilters(); // ADICIONE ESTA LINHA
        
        applyFilterAndSort();
    } catch (error) { console.error("Falha ao buscar dados dos servidores:", error); if(serverListContainer) serverListContainer.innerHTML = '<p class="empty-message">Erro ao carregar servidores.</p>';}
}
    
    async function showDetailsView(serverObject) {
    currentOpenServer = serverObject;
    // --- MUDANÇA 1: Adicionamos uma variável para controlar o mês do heatmap ---
    let heatmapDate = new Date(); 

    console.log("%c--- Função showDetailsView INICIADA com este objeto: ---", "color: #3b82f6; font-weight: bold;", serverObject);

    clearInterval(detailsUpdateIntervalId);
    window.showView('details');

    const nameEl = document.getElementById('details-server-name');
    const ipEl = document.getElementById('details-server-ip');
    const iconContainer = document.getElementById('details-server-icon');
    const typeEl = document.getElementById('details-server-type');
    const playerListEl = document.getElementById('details-player-list');
    const offlinePlayerListEl = document.getElementById('details-offline-player-list');
    const playerCountEl = document.getElementById('details-player-count');
    const statUptimeEl = document.getElementById('stat-uptime');
    const statPeakEl = document.getElementById('stat-peak');
    const statAvgEl = document.getElementById('stat-avg');

    const displayName = serverObject.nome_customizado || serverObject.nome_servidor || serverObject.ip_servidor;
    if (nameEl) renderMotdInElement(displayName, nameEl);
    if (ipEl) ipEl.textContent = serverObject.ip_servidor;
    if (typeEl) typeEl.innerHTML = formatServerType(serverObject.tipo_servidor);
    if (iconContainer) {
        iconContainer.innerHTML = '';
        iconContainer.dataset.ip = serverObject.ip_servidor;
        if (serverObject.tem_icone_customizado == 1) {
            loadIcon(iconContainer);
        } else {
            iconContainer.innerHTML = `<img src="/static/grass.png" alt="Ícone padrão">`;
        }
    }

    if(playerListEl) playerListEl.innerHTML = '<li>Carregando...</li>';
    if(offlinePlayerListEl) offlinePlayerListEl.innerHTML = '<li>Carregando...</li>';
    if(playerCountEl) playerCountEl.textContent = 'Jogadores Online';
    if(statUptimeEl) statUptimeEl.textContent = '--';
    if(statPeakEl) statPeakEl.textContent = '--';
    if(statAvgEl) statAvgEl.textContent = '--';

    const serverIp = serverObject.ip_servidor;
    const isRconConfigured = serverObject.rcon_port && serverObject.rcon_password;
    updateConsoleUI(isRconConfigured, serverObject);

    const periodSelector = document.querySelector('.chart-period-selector');
    let currentHours = 24;

    const fetchAndRenderDetails = async (hours = 24) => {
        try {
            // --- MUDANÇA 2: Removemos a busca do heatmap daqui ('calendarResponse') ---
            const [historyResponse, playersResponse, statsResponse, eventsResponse] = await Promise.all([
                fetch(`/api/servers/${serverIp}/history?hours=${hours}`),
                fetch(`/api/servers/${serverIp}/players`),
                fetch(`/api/servers/${serverIp}/stats`),
                fetch(`/api/servers/${serverIp}/events`)
            ]);
            
            if (!historyResponse.ok || !playersResponse.ok || !statsResponse.ok || !eventsResponse.ok) {  
                throw new Error("Falha em uma das APIs de detalhes.");  
            }
            
            const historyData = await historyResponse.json();
            const playersData = await playersResponse.json();
            const statsData = await statsResponse.json();
            const eventsData = await eventsResponse.json();
            
            if(statUptimeEl) statUptimeEl.textContent = `${statsData.uptime_percent}%`;
            if(statPeakEl) statPeakEl.textContent = statsData.peak_players;
            if(statAvgEl) statAvgEl.textContent = statsData.average_players;

            lastHistoryData = historyData;
            renderHistoryChart(historyData);
            renderPlayerLists(playersData.online, playersData.offline, serverObject.jogadores_maximos);
            renderEventTimeline(eventsData);
            // A renderização do heatmap foi removida daqui

        } catch (error) {
            console.error("Erro ao renderizar detalhes:", error);
            if (detailsUpdateIntervalId) {
                clearInterval(detailsUpdateIntervalId);
                detailsUpdateIntervalId = null;
            }
        }
    };
    
    if (periodSelector) {
        const newSelector = periodSelector.cloneNode(true);
        periodSelector.parentNode.replaceChild(newSelector, periodSelector);
        newSelector.addEventListener('click', (e) => {
            if (e.target.classList.contains('period-btn')) {
                const selectedHours = e.target.dataset.hours;
                if (selectedHours !== String(currentHours)) {
                    currentHours = Number(selectedHours);
                    if (newSelector.querySelector('.period-btn.active')) {
                        newSelector.querySelector('.period-btn.active').classList.remove('active');
                    }
                    e.target.classList.add('active');
                    fetchAndRenderDetails(currentHours);
                }
            }
        });
    }

    // --- MUDANÇA 3: Adicionamos a configuração dos botões e a chamada inicial do heatmap AQUI ---
    const prevBtn = document.getElementById('heatmap-prev-month-btn');
    const nextBtn = document.getElementById('heatmap-next-month-btn');

    // Remove listeners antigos para não acumular
    const newPrevBtn = prevBtn.cloneNode(true);
    prevBtn.parentNode.replaceChild(newPrevBtn, prevBtn);
    const newNextBtn = nextBtn.cloneNode(true);
    nextBtn.parentNode.replaceChild(newNextBtn, nextBtn);

    newPrevBtn.addEventListener('click', () => {
        heatmapDate.setMonth(heatmapDate.getMonth() - 1);
        updateHeatmap(serverIp, serverObject.jogadores_maximos, heatmapDate);
    });

    newNextBtn.addEventListener('click', () => {
        heatmapDate.setMonth(heatmapDate.getMonth() + 1);
        updateHeatmap(serverIp, serverObject.jogadores_maximos, heatmapDate);
    });
    
    // Carrega os dados iniciais do heatmap e do resto
    await updateHeatmap(serverIp, serverObject.jogadores_maximos, heatmapDate);
    await fetchAndRenderDetails(currentHours);
    
    setupConsole(serverIp);

    if (!detailsUpdateIntervalId) {
        detailsUpdateIntervalId = setInterval(() => fetchAndRenderDetails(currentHours), DETAILS_UPDATE_INTERVAL);
    }
}


    function setupSettingsPage() {
    // --- 1. SELEÇÃO DE TODOS OS ELEMENTOS DA PÁGINA ---
    const webhookInput = document.getElementById('discord-webhook-input');
    const statusToggle = document.getElementById('notify-status-toggle');
    const peakToggle = document.getElementById('notify-peak-toggle');
    const milestoneToggle = document.getElementById('notify-milestone-toggle');
    const firstJoinToggle = document.getElementById('notify-first-join-toggle');
    const saveButton = document.getElementById('save-settings-btn');
    const watchlistPlayerInput = document.getElementById('watchlist-player-input');
    const addWatchlistPlayerBtn = document.getElementById('add-watchlist-player-btn');
    const watchlistPlayerList = document.getElementById('watchlist-player-list');
    const webhookErrorMsg = document.getElementById('webhook-error-message');
    const watchlistErrorMsg = document.getElementById('watchlist-error-message');
    const ptBtn = document.getElementById('lang-pt-btn');
    const enBtn = document.getElementById('lang-en-btn');

    let currentServerForWatchlist = null;

    // --- 2. FUNÇÕES AUXILIARES ---
    async function loadSettings() {
        try {
            const response = await fetch('/api/settings/global');
            if (!response.ok) {
                console.error("API de configurações não encontrada (404).");
                return;
            }
            const settings = await response.json();
            
            if (settings) {
                if (webhookInput) webhookInput.value = settings.discord_webhook_url || '';
                if (statusToggle) statusToggle.checked = settings.notificar_online_offline;
                if (peakToggle) peakToggle.checked = settings.notificar_pico_jogadores;
                if (milestoneToggle) milestoneToggle.checked = settings.notificar_marcos_lotacao;
                if (firstJoinToggle) firstJoinToggle.checked = settings.notificar_primeira_entrada;
            }

            if (allServersCache.length > 0) {
                currentServerForWatchlist = allServersCache[0].ip_servidor;
                const wlResponse = await fetch(`/api/watchlist/${currentServerForWatchlist}`);
                if (wlResponse.ok) {
                    const watchlist = await wlResponse.json();
                    renderWatchlist(watchlist);
                }
            }
        } catch (error) {
            console.error("Erro ao carregar configurações:", error);
        }
    }

    function renderWatchlist(players) {
        if (!watchlistPlayerList) return;
        watchlistPlayerList.innerHTML = '';
        players.forEach(player => {
            const li = document.createElement('li');
            const playerName = player.nome_jogador;
            li.dataset.playerName = playerName;
            const headUrl = `https://minotar.net/avatar/${playerName}/28`;

            li.innerHTML = `
                <div class="player-info-left">
                    <img src="${headUrl}" class="player-head" alt="${playerName}" onerror="this.onerror=null; this.src='/static/player-head-cracked.jpg';">
                    <span class="player-name">${playerName}</span>
                </div>
                <button class="remove-watchlist-btn" title="${translations.card_tooltip_remove || 'Remover'}" data-player-name="${playerName}">&times;</button>
            `;
            watchlistPlayerList.appendChild(li);
        });
    }

    // --- 3. CONFIGURAÇÃO DOS EVENTOS ---
    if(ptBtn) ptBtn.addEventListener('click', () => setLanguage('pt'));
    if(enBtn) enBtn.addEventListener('click', () => setLanguage('en'));

    if (saveButton) {
        saveButton.addEventListener('click', async () => {
            saveButton.disabled = true;
            saveButton.textContent = translations.settings_btn_saving || 'Salvando...';
            const settingsToSave = {
                discord_webhook_url: webhookInput.value.trim(),
                notificar_online_offline: statusToggle.checked,
                notificar_pico_jogadores: peakToggle.checked,
                notificar_marcos_lotacao: milestoneToggle.checked,
                notificar_primeira_entrada: firstJoinToggle.checked,
            };
            try {
                await fetch('/api/settings/global', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(settingsToSave)
                });
                alert(translations.settings_alert_success || 'Configurações salvas com sucesso!');
            } catch (error) {
                alert(translations.settings_alert_error || 'Falha ao salvar configurações.');
            } finally {
                saveButton.disabled = false;
                saveButton.textContent = translations.settings_btn_save || 'Salvar Configurações';
            }
        });
    }

    if (addWatchlistPlayerBtn) {
        addWatchlistPlayerBtn.addEventListener('click', async () => {
            if (!webhookInput.value.trim()) {
                alert('A URL do Webhook do Discord é necessária para notificações de jogador.');
                return;
            }
            const playerName = watchlistPlayerInput.value.trim();
            if (!playerName || !currentServerForWatchlist) return;

            try {
                const response = await fetch(`/api/watchlist/${currentServerForWatchlist}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ nome_jogador: playerName })
                });
                if (response.ok) {
                    watchlistPlayerInput.value = '';
                    loadSettings(); // Recarrega a lista
                } else {
                    const error = await response.json();
                    alert(`Erro: ${error.detail}`);
                }
            } catch (error) {
                alert('Falha ao adicionar jogador.');
            }
        });
    }

    if (watchlistPlayerList) {
        watchlistPlayerList.addEventListener('click', async (e) => {
            const removeBtn = e.target.closest('.remove-watchlist-btn');
            if (removeBtn) {
                const playerName = removeBtn.dataset.playerName;
                if (!playerName) return;

                const title = translations.watchlist_remove_title || 'Remover Jogador';
                const message = (translations.watchlist_remove_message || 'Tem certeza que deseja parar de monitorar {player}?').replace('{player}', playerName);

                showConfirmModal(title, message, async () => {
                    try {
                        const response = await fetch(`/api/watchlist/${currentServerForWatchlist}/${playerName}`, { method: 'DELETE' });
                        if (response.ok) {
                            loadSettings(); // Recarrega a lista
                        } else {
                            alert('Falha ao remover jogador.');
                        }
                    } catch (error) {
                        alert('Falha na conexão ao remover jogador.');
                    }
                });
            }
        });
    }
    
    // Listener para o botão de navegação "Settings"
    if (navButtons.settings) {
        navButtons.settings.addEventListener('click', () => {
            if (webhookErrorMsg) webhookErrorMsg.style.display = 'none';
            if (watchlistErrorMsg) watchlistErrorMsg.style.display = 'none';
            loadSettings();
        });
    }
}

const getOrCreateTooltip = (chart) => {
    let tooltipEl = chart.canvas.parentNode.querySelector('#chartjs-tooltip');

    if (!tooltipEl) {
        tooltipEl = document.createElement('div');
        tooltipEl.id = 'chartjs-tooltip';
        tooltipEl.classList.add('chart-tooltip');
        
        const titleEl = document.createElement('div');
        titleEl.classList.add('tooltip-title');
        
        const bodyEl = document.createElement('div');
        bodyEl.classList.add('tooltip-body');

        tooltipEl.appendChild(titleEl);
        tooltipEl.appendChild(bodyEl);
        chart.canvas.parentNode.appendChild(tooltipEl);
    }
    return tooltipEl;
};

const customTooltipHandler = (context) => {
    const { chart, tooltip } = context;
    const tooltipEl = getOrCreateTooltip(chart);

    if (tooltip.opacity === 0) {
        tooltipEl.style.opacity = 0;
        return;
    }

    if (tooltip.title) {
        const titleEl = tooltipEl.querySelector('.tooltip-title');
        titleEl.innerText = tooltip.title;
    }

    const bodyEl = tooltipEl.querySelector('.tooltip-body');
    bodyEl.innerHTML = '';

    tooltip.body.forEach((bodyItem, i) => {
        const dataPoint = tooltip.dataPoints[i];
        const datasetLabel = dataPoint.dataset.label;
        const rawValue = dataPoint.raw;
        let pointColor;

        // ---- LÓGICA CORRIGIDA AQUI ----
        // Agora verificamos o 'id' que não muda, em vez do 'label' que é traduzido
        if (dataPoint.dataset.id === 'io') {
            pointColor = getComputedStyle(document.documentElement).getPropertyValue('--text-negative').trim();
        } else {
            pointColor = dataPoint.dataset.borderColor;
        }

        const item = document.createElement('div');
        item.classList.add('tooltip-item');
        const point = document.createElement('span');
        point.classList.add('tooltip-point');
        point.style.backgroundColor = pointColor;
        point.style.borderColor = pointColor;
        const label = document.createElement('span');
        label.classList.add('tooltip-label');
        label.innerText = datasetLabel + ':'; // Usa o label já traduzido
        const value = document.createElement('span');
        value.classList.add('tooltip-value');

        // A formatação do valor agora também usa o 'id' para ser mais segura
        if (dataPoint.dataset.id === 'occupancy') {
            value.innerText = parseFloat(rawValue).toFixed(2) + '%';
        } else if (dataPoint.dataset.id === 'ping') {
            value.innerText = rawValue + 'ms';
        } else if (dataPoint.dataset.id === 'io') {
            value.innerText = (rawValue > 0 ? '+' : '') + rawValue;
        } else {
            value.innerText = rawValue;
        }

        item.appendChild(point);
        item.appendChild(label);
        item.appendChild(value);
        bodyEl.appendChild(item);
    });

    const { offsetLeft: positionX, offsetTop: positionY } = chart.canvas;
    tooltipEl.style.opacity = 1;
    tooltipEl.style.left = positionX + tooltip.caretX + 'px';
    tooltipEl.style.top = positionY + tooltip.caretY + 'px';
};
    function renderHistoryChart(data) {
    const canvas = document.getElementById('history-chart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    if (!data || data.length === 0) {
        if (historyChart) {
            historyChart.destroy();
            historyChart = null;
        }
        const textColor = getComputedStyle(document.documentElement).getPropertyValue('--text-secondary').trim();
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.font = "16px 'Inter', sans-serif";
        ctx.fillStyle = textColor;
        ctx.textAlign = 'center';
        ctx.fillText("Sem histórico de atividade para exibir neste período.", canvas.width / 2, canvas.height / 2);
        return;
    }

    // Prepara os novos dados
    const labels = data.map(d => new Date(d.timestamp));
    const pings = data.map(d => d.ping);
    const lotacao = data.map(d => d.lotacao_percentual);
    const variacao = data.map(d => d.variacao_jogadores);
    const jogadores = data.map(d => d.jogadores_online);
    const textPositive = getComputedStyle(document.documentElement).getPropertyValue('--text-positive').trim();
    const textNegative = getComputedStyle(document.documentElement).getPropertyValue('--text-negative').trim();

    if (historyChart) {
        historyChart.data.labels = labels;
        historyChart.data.datasets[0].data = variacao;
        historyChart.data.datasets[0].backgroundColor = variacao.map(v => v > 0 ? textPositive : (v < 0 ? textNegative : 'transparent'));
        historyChart.data.datasets[0].borderColor = variacao.map(v => v > 0 ? textPositive : (v < 0 ? textNegative : 'transparent'));
        historyChart.data.datasets[1].data = lotacao;
        historyChart.data.datasets[2].data = pings;
        historyChart.data.datasets[3].data = jogadores;
        historyChart.update('none');
        return;
    }

    const legendContainer = document.getElementById('details-legend-container');
    if(legendContainer) legendContainer.innerHTML = ''; 
    
    const gridColor = getComputedStyle(document.documentElement).getPropertyValue('--border-color').trim();
    const textColor = getComputedStyle(document.documentElement).getPropertyValue('--text-secondary').trim();
    const accentBlue = getComputedStyle(document.documentElement).getPropertyValue('--accent-blue').trim();
    const accentGreen = getComputedStyle(document.documentElement).getPropertyValue('--accent-green').trim();
    const accentOrange = getComputedStyle(document.documentElement).getPropertyValue('--accent-orange').trim();

    historyChart = new Chart(ctx, {
        data: {
            labels: labels,
            datasets: [
                { id: 'io', type: 'bar', label: translations.legend_io || 'Entrada/Saída', data: variacao, backgroundColor: variacao.map(v => v > 0 ? textPositive : (v < 0 ? textNegative : 'transparent')), borderColor: variacao.map(v => v > 0 ? textPositive : (v < 0 ? textNegative : 'transparent')), barThickness: 4, yAxisID: 'yVariacao', order: 3 },
                { id: 'occupancy', type: 'line', label: translations.legend_occupancy || 'Lotação (%)', data: lotacao, borderColor: accentOrange, yAxisID: 'yLotacao', tension: 0.4, borderWidth: 3.5, pointRadius: 0, pointHoverRadius: 6, pointBackgroundColor: accentOrange, pointBorderColor: 'white', order: 2 },
                { id: 'ping', type: 'line', label: translations.legend_ping || 'Ping (ms)', data: pings, borderColor: accentGreen, yAxisID: 'yPing', tension: 0.4, borderWidth: 3.5, pointRadius: 0, pointHoverRadius: 6, pointBackgroundColor: accentGreen, pointBorderColor: 'white', order: 1 },
                { id: 'players', type: 'line', label: translations.legend_players || 'Jogadores', data: jogadores, borderColor: accentBlue, backgroundColor: 'transparent', yAxisID: 'yJogadores', tension: 0.4, borderWidth: 3.5, pointRadius: 0, pointHoverRadius: 6, pointBackgroundColor: accentBlue, pointBorderColor: 'white', order: 0, clip: false }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 0 },
            interaction: { intersect: false, mode: 'index' },
            scales: {
                x: { type: 'time', time: { unit: 'hour', tooltipFormat: 'dd/MM HH:mm', displayFormats: { hour: 'HH:mm', day: 'dd/MM' } }, ticks: { color: textColor, maxRotation: 0, autoSkip: true }, grid: { drawOnChartArea: false, drawBorder: false } },
                yPing: { type: 'linear', display: true, position: 'right', title: { display: true, text: translations.legend_ping || 'Ping (ms)', color: textColor }, grid: { drawOnChartArea: false }, min: 0, ticks: { color: textColor } },
                yLotacao: { type: 'linear', display: true, position: 'right', title: { display: true, text: translations.legend_occupancy || 'Lotação (%)', color: textColor }, min: 0, max: 100, grid: { drawOnChartArea: false }, ticks: { color: textColor, callback: value => value + '%' } },
                yJogadores: { type: 'linear', display: true, position: 'left', title: { display: true, text: translations.legend_players || 'Jogadores', color: textColor }, min: 0, suggestedMax: 10, grid: { color: gridColor, borderDash: [2, 3], drawBorder: false }, ticks: { color: textColor, precision: 0 } },
                yVariacao: { display: false }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    enabled: false,
                    external: customTooltipHandler,
                    events: ['click']
                },
                zoom: { pan: { enabled: true, mode: 'x', modifierKey: 'ctrl' }, zoom: { wheel: { enabled: true }, pinch: { enabled: true }, mode: 'x' }, onZoomComplete: function ({ chart }) { document.getElementById('contextual-reset-zoom-btn').classList.remove('hidden'); }, onPanComplete: function ({ chart }) { document.getElementById('contextual-reset-zoom-btn').classList.remove('hidden'); } }
            }
        }
    });

    canvas.addEventListener('mouseleave', () => {
        const tooltipEl = getOrCreateTooltip(historyChart);
        if (tooltipEl) {
            tooltipEl.style.opacity = 0;
        }
    });

    if (legendContainer) {
        historyChart.data.datasets.forEach((dataset, index) => {
            const legendItem = document.createElement('div');
            legendItem.className = 'legend-item';
            const symbol = document.createElement('span');
            symbol.className = 'legend-symbol';
            let symbolColor = dataset.borderColor;
            if (Array.isArray(symbolColor)) symbolColor = textNegative;
            symbol.style.backgroundColor = symbolColor;
            const text = document.createElement('span');
            text.className = 'legend-text';
            text.innerText = dataset.label; // Pega o label já traduzido
            legendItem.appendChild(symbol);
            legendItem.appendChild(text);
            legendItem.onclick = () => {
                const isVisible = historyChart.isDatasetVisible(index);
                historyChart.setDatasetVisibility(index, !isVisible);
                legendItem.classList.toggle('desativado', isVisible);
                historyChart.update();
            };
            legendContainer.appendChild(legendItem);
        });
    }
}
    
    function renderPlayerLists(onlinePlayers, offlinePlayers, maxPlayers) {
    const onlineListEl = document.getElementById('details-player-list');
    const offlineListEl = document.getElementById('details-offline-player-list');
    const onlineCountEl = document.getElementById('details-player-count');
    
    // ---- CORREÇÃO AQUI: Agora ele busca pelo ID que adicionamos ----
    const offlineTitleEl = document.getElementById('details-last-seen-title'); 

    // Traduz o título dos jogadores offline
    if (offlineTitleEl) {
        offlineTitleEl.textContent = translations.details_last_seen_title || 'Vistos por Último';
    }

    if (onlineListEl && onlineCountEl) {
        onlineListEl.innerHTML = '';
        
        // Traduz o título dos jogadores online
        if (maxPlayers && maxPlayers > 0) {
            let title = translations.details_online_players_title || 'Jogadores Online ({current}/{max})';
            onlineCountEl.textContent = title.replace('{current}', onlinePlayers.length).replace('{max}', maxPlayers);
        } else {
            let title = translations.details_online_players_title_no_max || 'Jogadores Online ({current})';
            onlineCountEl.textContent = title.replace('{current}', onlinePlayers.length);
        }

        // Traduz a mensagem de lista vazia
        if (onlinePlayers.length === 0) {
            const emptyMsg = translations.details_no_players_online || 'Nenhum jogador online.';
            onlineListEl.innerHTML = `<li>${emptyMsg}</li>`;
        } else {
            onlinePlayers.sort().forEach(playerName => {
                const li = document.createElement('li');
                const headUrl = `https://minotar.net/avatar/${playerName}/28`;
                li.innerHTML = `
                    <div class="player-info-left">
                        <img src="${headUrl}" class="player-head" alt="${playerName}" onerror="this.onerror=null; this.src='/static/player-head-cracked.jpg';">
                        <span class="player-name">${playerName}</span>
                    </div>`;
                onlineListEl.appendChild(li);
            });
        }
    }

    if (offlineListEl) {
        offlineListEl.innerHTML = '';
        // Traduz a mensagem de lista vazia
        if (offlinePlayers.length === 0) {
            const emptyMsg = translations.details_no_players_seen || 'Nenhum jogador visto recentemente.';
            offlineListEl.innerHTML = `<li>${emptyMsg}</li>`;
        } else {
            offlinePlayers.forEach(player => {
                const li = document.createElement('li');
                const playerName = player.nome_jogador;
                const lastSeenFormatted = formatLastSeen(player.ultima_vez_visto);
                const headUrl = `https://minotar.net/avatar/${playerName}/28`;
                li.innerHTML = `
                    <div class="player-info-left">
                        <img src="${headUrl}" class="player-head" alt="${playerName}" onerror="this.onerror=null; this.src='/static/player-head-cracked.jpg';">
                        <span class="player-name">${playerName}</span>
                    </div>
                    <span class="player-offline-time">${lastSeenFormatted}</span>`;
                offlineListEl.appendChild(li);
            });
        }
    }
}

    async function updateHeatmap(serverIp, maxPlayers, date) {
    const monthLabel = document.getElementById('heatmap-month-label');
    const prevBtn = document.getElementById('heatmap-prev-month-btn');
    const nextBtn = document.getElementById('heatmap-next-month-btn');

    if (!monthLabel || !prevBtn || !nextBtn) return;

    // Atualiza o título com o nome do mês e ano
    const localeCode = currentLangCode === 'en' ? 'en-US' : 'pt-BR';
    const monthName = date.toLocaleString(localeCode, { month: 'long' });
    monthLabel.textContent = `${monthName.charAt(0).toUpperCase() + monthName.slice(1)} ${date.getFullYear()}`;

    // Desabilita o botão "próximo" se estivermos no mês atual ou futuro
    const now = new Date();
    nextBtn.disabled = (date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth());

    try {
        const year = date.getFullYear();
        const month = date.getMonth() + 1; // JS month é 0-11, API espera 1-12

        // Chama a nossa NOVA API com os parâmetros
        const response = await fetch(`/api/servers/${serverIp}/calendar_heatmap?year=${year}&month=${month}`);
        if (!response.ok) throw new Error("API do heatmap falhou");

        const heatmapData = await response.json();

        // Chama a função que apenas desenha, passando a data e os dados
        renderCalendarHeatmap(heatmapData, maxPlayers, date);

    } catch (error) {
        console.error("Erro ao atualizar o heatmap:", error);
        const container = document.getElementById('cal-heatmap');
        if(container) container.innerHTML = '<p class="empty-message">Erro ao carregar dados.</p>';
    }
}


// Função 2: A Desenhista (versão modificada da sua função antiga)
function renderCalendarHeatmap(data, maxPlayers, referenceDate) {
    const container = document.getElementById('cal-heatmap');
    if (!container) return;
    container.innerHTML = ''; 

    const weekdayContainer = document.createElement('div');
    weekdayContainer.className = 'heatmap-weekdays';
    const dayGridContainer = document.createElement('div');
    dayGridContainer.className = 'heatmap-day-grid';

    const dataMap = new Map(data.map(d => [new Date(Number(d.timestamp) * 1000).toISOString().split('T')[0], d.value]));
    const currentYear = referenceDate.getFullYear();
    const currentMonth = referenceDate.getMonth();
    const firstDayOfMonth = new Date(currentYear, currentMonth, 1);
    const startingWeekday = firstDayOfMonth.getDay();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

    const weekdays = [
        translations.heatmap_weekday_sun || 'DOM', translations.heatmap_weekday_mon || 'SEG',
        translations.heatmap_weekday_tue || 'TER', translations.heatmap_weekday_wed || 'QUA',
        translations.heatmap_weekday_thu || 'QUI', translations.heatmap_weekday_fri || 'SEX',
        translations.heatmap_weekday_sat || 'SÁB'
    ];
    
    weekdays.forEach(day => {
        const weekdayCell = document.createElement('div');
        weekdayCell.className = 'heatmap-weekday';
        weekdayCell.textContent = day;
        weekdayContainer.appendChild(weekdayCell);
    });

    for (let i = 0; i < startingWeekday; i++) {
        dayGridContainer.appendChild(document.createElement('div'));
    }

    const today = new Date();
    
    // Esta função de cor está correta, não precisa mudar.
    function getColorForLotação(value, max) {
        if (value <= 0 || !max || max <= 0) return 'rgba(100, 116, 139, 0.2)'; // Cinza claro para dias passados sem dados
        const lotacao = value / max;
        if (lotacao <= 0.20) return '#6ee7b7';
        else if (lotacao <= 0.45) return 'var(--accent-green)';
        else if (lotacao <= 0.70) return 'var(--accent-yellow)';
        else return 'var(--accent-red)';
    }

    for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(currentYear, currentMonth, day);
        const dayCell = document.createElement('div');
        dayCell.className = 'heatmap-day';

        // ---- A LÓGICA CORRIGIDA ESTÁ AQUI ----
        if (date <= today) {
            // DIAS PASSADOS: Pinta com a cor da atividade ou um cinza claro se não houver dados.
            const dateString = date.toISOString().split('T')[0];
            const value = dataMap.get(dateString) || 0;
            dayCell.style.backgroundColor = getColorForLotação(value, maxPlayers);
            
            const localeCode = currentLangCode === 'en' ? 'en-US' : 'pt-BR';
            const formattedDate = date.toLocaleDateString(localeCode, { year: 'numeric', month: '2-digit', day: '2-digit' });
            const lotacaoPercent = maxPlayers > 0 ? Math.round((value / maxPlayers) * 100) : 0;
            let tooltipTemplate = translations.heatmap_tooltip || '{date}: {value} jogadores em média ({percent}%)';
            const tooltipText = tooltipTemplate.replace('{date}', formattedDate).replace('{value}', Math.round(value)).replace('{percent}', lotacaoPercent);
            
            dayCell.addEventListener('mouseenter', () => {
                heatmapTooltip.textContent = tooltipText;
                heatmapTooltip.style.display = 'block';
            });
            dayCell.addEventListener('mouseleave', () => heatmapTooltip.style.display = 'none');
            dayCell.addEventListener('mousemove', (e) => {
                heatmapTooltip.style.left = `${e.clientX + 15}px`;
                heatmapTooltip.style.top = `${e.clientY + 15}px`;
            });
        } else {
            // DIAS FUTUROS: Pinta com uma cor escura "desativada".
            dayCell.style.backgroundColor = 'var(--bg-input)'; // <-- CORREÇÃO!
            dayCell.style.cursor = 'default';
        }
        // -----------------------------------------
        
        dayGridContainer.appendChild(dayCell);
    }

    container.appendChild(weekdayContainer);
    container.appendChild(dayGridContainer);
}

    function formatLastSeen(isoString) {
    if (!isoString) return '';
    const now = new Date();
    const lastSeenDate = new Date(isoString);
    const diffSeconds = Math.round((now - lastSeenDate) / 1000);
    
    if (diffSeconds < 60) return translations.time_now || 'agora mesmo';
    
    if (diffSeconds < 3600) {
        let template = translations.time_minutes_ago || 'há {minutes} min';
        return template.replace('{minutes}', Math.floor(diffSeconds / 60));
    }
    
    if (diffSeconds < 86400) {
        let template = translations.time_hours_ago || 'há {hours}h';
        return template.replace('{hours}', Math.floor(diffSeconds / 3600));
    }
    
    const timeString = lastSeenDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    if (now.toDateString() === lastSeenDate.toDateString()) {
        let template = translations.time_today_at || 'hoje às {time}';
        return template.replace('{time}', timeString);
    }

    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (yesterday.toDateString() === lastSeenDate.toDateString()) {
        let template = translations.time_yesterday_at || 'ontem às {time}';
        return template.replace('{time}', timeString);
    }
    
    return lastSeenDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
    
    const editModal = document.getElementById('edit-server-modal');
    const editForm = document.getElementById('edit-server-form');
    const editNameInput = document.getElementById('edit-name-input');
    const editIpInput = document.getElementById('edit-ip-input');
    const editErrorMessage = document.getElementById('edit-error-message');
    const editBtnCancel = document.getElementById('edit-btn-cancel');

    function showEditModal(original_ip) {
    const serverData = allServersCache.find(s => s.ip_servidor === original_ip);
    if (!serverData || !editModal) return;

    // Pega todos os elementos que vamos manipular
    const editPathInput = document.getElementById('edit-path-input');
    const editRconPortInput = document.getElementById('edit-rcon-port-input');
    const editRconPassInput = document.getElementById('edit-rcon-pass-input');
    const unlockRconBtn = document.getElementById('unlock-rcon-btn');

    // Limpa e prepara o botão de destravar
    unlockRconBtn.innerHTML = editIconSVG(); // Coloca o ícone de lápis
    unlockRconBtn.style.display = 'none'; // Começa escondido

    // Preenche os campos com os dados existentes
    editErrorMessage.style.display = 'none';
    editErrorMessage.textContent = '';
    editNameInput.value = serverData.nome_customizado || '';
    editIpInput.value = serverData.ip_servidor;
    editPathInput.value = serverData.caminho_servidor || '';
    editRconPortInput.value = serverData.rcon_port || '';
    editRconPassInput.value = serverData.rcon_password || '';

    // A LÓGICA DO COFRE
    const isRconConfigured = serverData.rcon_port && serverData.rcon_password;

    if (isRconConfigured) {
        // Se já está configurado, TRAVA os campos e mostra o botão de editar
        editRconPortInput.disabled = true;
        editRconPassInput.disabled = true;
        unlockRconBtn.style.display = 'flex';
    } else {
        // Se não está configurado, garante que os campos estejam DESTRAVADOS
        editRconPortInput.disabled = false;
        editRconPassInput.disabled = false;
    }
    
    // Adiciona o evento de clique para o botão "lápis"
    unlockRconBtn.onclick = () => {
        editRconPortInput.disabled = false;
        editRconPassInput.disabled = false;
        editRconPortInput.focus(); // Foca no campo da porta para o usuário já sair digitando
        unlockRconBtn.style.display = 'none'; // Esconde o lápis depois de clicar
    };

    editForm.dataset.originalIp = original_ip;
    editModal.classList.add('visible');
}

    function hideEditModal() { if (editModal) editModal.classList.remove('visible'); }

if (editForm) {
    editForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const originalIp = editForm.dataset.originalIp;
        const saveButton = editForm.querySelector('button[type="submit"]');
        
        // 1. Pega os elementos que vamos manipular
        const errorMessageDiv = document.getElementById('edit-error-message');
        const rconPassInput = document.getElementById('edit-rcon-pass-input');

        const rconPort = parseInt(document.getElementById('edit-rcon-port-input').value, 10);
        const rconPassword = rconPassInput.value; // Usando a variável que pegamos
        const newIp = document.getElementById('edit-ip-input').value.trim();

        saveButton.disabled = true;
        saveButton.textContent = translations.modal_edit_btn_saving_test || 'Verificando...';
        errorMessageDiv.style.display = 'none';

        try {
            if (rconPort && rconPassword) {
                const testResponse = await fetch('/api/rcon/test', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ip: newIp, rcon_port: rconPort, rcon_password: rconPassword })
                });

                if (!testResponse.ok) {
                    const errorResult = await testResponse.json();
                    throw new Error(errorResult.detail || 'Falha na validação RCON.');
                }
            }

            saveButton.textContent = translations.modal_edit_btn_saving || 'Salvando...';
            // Prepara os dados para salvar (removendo a senha se não for alterada)
            const dataToSave = {
                custom_name: document.getElementById('edit-name-input').value.trim(),
                caminho_servidor: document.getElementById('edit-path-input').value.trim(),
                rcon_port: isNaN(rconPort) ? null : rconPort,
                // Só envia a senha se ela foi de fato digitada
                rcon_password: rconPassword || undefined
            };
            if (newIp !== originalIp) dataToSave.new_ip = newIp;

            const saveResponse = await fetch(`/api/servers/${originalIp}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(dataToSave)
            });

            if (!saveResponse.ok) {
                const errorResult = await saveResponse.json();
                throw new Error(errorResult.detail || 'Falha ao salvar as alterações.');
            }

            hideEditModal();
            await fetchAndUpdateServers();
            
            const detailsView = document.getElementById('details-view');
            if (detailsView.style.display !== 'none') {
                 const finalIp = newIp || originalIp;
                 // A API de busca retorna a lista atualizada, vamos buscar nela
                 const updatedServerObject = allServersCache.find(s => s.ip_servidor === finalIp);
                 if (updatedServerObject) showDetailsView(updatedServerObject);
                 else window.showView('dashboard');
            }

        } catch (error) {
            // --- LÓGICA DE ERRO ATUALIZADA ---
            // 2. Verifica se o erro é de senha incorreta
            if (error.message.includes("Senha RCON incorreta")) {
                // 3. Aplica a animação de tremida
                rconPassInput.classList.add('input-shake');
                
                // 4. Limpa o campo
                rconPassInput.value = '';
                
                // 5. Exibe a mensagem amigável
                errorMessageDiv.textContent = "Senha RCON incorreta. Por favor, tente novamente.";
                errorMessageDiv.style.display = 'block';

                // 6. Remove a classe da animação após 500ms para que possa ser reativada
                setTimeout(() => {
                    rconPassInput.classList.remove('input-shake');
                }, 500);

            } else {
                // Para todos os outros erros, exibe a mensagem normalmente
                errorMessageDiv.textContent = error.message;
                errorMessageDiv.style.display = 'block';
            }
        } finally {
            // Reabilita o botão no final
            saveButton.disabled = false;
            saveButton.textContent = translations.modal_edit_btn_save || 'Salvar Alterações';
        }
    });
}

    if (editBtnCancel) editBtnCancel.addEventListener('click', hideEditModal);
    if (editModal) editModal.addEventListener('click', (e) => { if (e.target === editModal) hideEditModal(); });

    function setupCardActions() {
    if (!serverListContainer) return;

    let currentHoveredIP = null;
    let fetchTimeoutId = null;

    serverListContainer.addEventListener('mousemove', (event) => {
        const icon = event.target.closest('.server-icon');
        const ip = icon ? icon.dataset.ip : null;

        if (playerTooltip.classList.contains('visible')) {
            playerTooltip.style.left = `${event.pageX + 15}px`;
            playerTooltip.style.top = `${event.pageY + 15}px`;
        }

        if (ip && ip !== currentHoveredIP) {
            currentHoveredIP = ip;
            clearTimeout(fetchTimeoutId);
            
            if (!playerTooltip.classList.contains('visible')) {
                const title = translations.tooltip_players_title || 'Jogadores Online';
                const loading = translations.tooltip_players_loading || 'Carregando...';
                playerTooltip.innerHTML = `<div class="player-tooltip-title">${title}</div><ul class="player-tooltip-list"><li>${loading}</li></ul>`;
                playerTooltip.classList.add('visible');
            }

            fetchTimeoutId = setTimeout(() => {
                fetch(`/api/servers/${ip}/players`)
                    .then(res => res.json())
                    .then(data => {
                        if (currentHoveredIP === ip) {
                            const list = playerTooltip.querySelector('.player-tooltip-list');
                            if (list) {
                                if (data.online && data.online.length > 0) {
                                    list.innerHTML = data.online.map(p => `<li>${p}</li>`).join('');
                                } else {
                                    const emptyMsg = translations.tooltip_players_empty || 'Nenhum jogador online.';
                                    list.innerHTML = `<li>${emptyMsg}</li>`;
                                }
                            }
                        }
                    })
                    .catch(() => {
                        if (currentHoveredIP === ip) {
                            const list = playerTooltip.querySelector('.player-tooltip-list');
                            const errorMsg = translations.tooltip_players_error || 'Erro ao buscar.';
                            if(list) list.innerHTML = `<li>${errorMsg}</li>`;
                        }
                    });
            }, 200);

        } else if (!ip && currentHoveredIP) {
            currentHoveredIP = null;
            clearTimeout(fetchTimeoutId);
            playerTooltip.classList.remove('visible');
        }
    });

    serverListContainer.addEventListener('click', (event) => {
        playerTooltip.classList.remove('visible');
        clearTimeout(fetchTimeoutId);
        currentHoveredIP = null;

        const button = event.target.closest('.card-action-btn');
        if (button) {
            event.stopPropagation();
            const action = button.dataset.action;
            const ip = button.dataset.ip;
            
            if (action === 'edit') showEditModal(ip);
            
            // ---- INÍCIO DO BLOCO CORRIGIDO ----
            if (action === 'delete') {
                const title = translations.modal_delete_title || 'Remover Servidor';
                let message = (translations.modal_delete_message || 'Tem certeza que deseja remover {ip}?').replace('{ip}', ip);
                
                showConfirmModal(title, message, async () => {
                    // Esta parte estava vazia no seu código. Agora ela tem a lógica de exclusão.
                    console.log(`[DEBUG] Tentando apagar o servidor com IP: ${ip}`);
                    try {
                        const response = await fetch(`/api/servers/${ip}`, { method: 'DELETE' });
                        
                        console.log('[DEBUG] Resposta do backend:', response);
                        console.log(`[DEBUG] Status da resposta: ${response.status}`);
                        console.log(`[DEBUG] Resposta foi 'ok'? ${response.ok}`);

                        if (response.ok) {
                            console.log('[DEBUG] A resposta foi OK. Atualizando a lista de servidores...');
                            await fetchAndUpdateServers();
                            console.log('[DEBUG] Lista de servidores atualizada.');
                        } else {
                            const err = await response.json();
                            console.error('[DEBUG] Backend retornou um erro:', err);
                            alert(`Erro ao apagar: ${err.detail}`);
                        }
                    } catch (e) {
                        console.error('[DEBUG] Ocorreu um erro de conexão no fetch:', e);
                        alert("Erro de conexão ao tentar apagar.");
                    }
                });
            }
            // ---- FIM DO BLOCO CORRIGIDO ----

            if (action === 'pause') fetch(`/api/servers/${ip}/toggle_pause`, { method: 'POST' }).then(res => { if(res.ok) fetchAndUpdateServers() });

        } else {
            const card = event.target.closest('.server-card');
            if (card) {
                const serverIp = card.dataset.ip;
                const serverObject = allServersCache.find(s => s.ip_servidor === serverIp);
                if (serverObject) {
                    showDetailsView(serverObject);
                }
            }
        }
    });
}

    let currentSort = { key: 'nome_servidor', direction: 'asc' };
    function applyFilterAndSort() {
    let filtered = [...allServersCache];

    // Filtros
    const searchTerm = document.getElementById('search-input').value.toLowerCase();
    const selectedType = document.getElementById('filter-type').value;
    const selectedFlavor = document.getElementById('filter-flavor').value;
    const selectedBaseVersion = document.getElementById('filter-base-version').value;

    if (searchTerm) {
        filtered = filtered.filter(server => {
            const displayName = server.nome_customizado || server.nome_servidor || '';
            return displayName.toLowerCase().includes(searchTerm) || server.ip_servidor.toLowerCase().includes(searchTerm);
        });
    }
    if (selectedType) {
        filtered = filtered.filter(server => server.tipo_servidor === selectedType);
    }
    if (selectedFlavor) {
        filtered = filtered.filter(server => parseVersion(server.versao).flavor === selectedFlavor);
    }
    if (selectedBaseVersion) {
        filtered = filtered.filter(server => parseVersion(server.versao).baseVersion === selectedBaseVersion);
    }

    // Ordenação
    const sortBy = document.getElementById('sort-by').value.split('-');
    const sortKey = sortBy[0];
    const sortDirection = sortBy[1];

    filtered.sort((a, b) => {
        let valA = a[sortKey];
        let valB = b[sortKey];

        if (sortKey === 'jogadores_online' || sortKey === 'ping') {
            valA = valA ?? -1;
            valB = valB ?? -1;
        } else {
            valA = (valA || '').toString().toLowerCase();
            valB = (valB || '').toString().toLowerCase();
        }

        if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
        if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
        return 0;
    });

    renderServerList(filtered);
}

    function setupDashboardControls() {
    const searchInput = document.getElementById('search-input');
    const toggleBtn = document.getElementById('toggle-filters-btn');
    const filtersContainer = document.getElementById('filters-container');
    const typeFilter = document.getElementById('filter-type');
    const flavorFilter = document.getElementById('filter-flavor');
    const baseVersionFilter = document.getElementById('filter-base-version');
    const sortBy = document.getElementById('sort-by');

    if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {
            filtersContainer.classList.toggle('hidden');
            toggleBtn.classList.toggle('active');
        });
    }

    if(searchInput) searchInput.addEventListener('input', applyFilterAndSort);
    if(typeFilter) typeFilter.addEventListener('change', applyFilterAndSort);
    if(flavorFilter) flavorFilter.addEventListener('change', applyFilterAndSort);
    if(baseVersionFilter) baseVersionFilter.addEventListener('change', applyFilterAndSort);
    if(sortBy) sortBy.addEventListener('change', applyFilterAndSort);
}

    function setupAddForms() {
        async function processIpList(ips, logElement, form) {
    logElement.innerHTML = ''; 
    logElement.style.display = 'block';
    const button = form.querySelector('button'); 
    if (button) button.disabled = true;
    
    let successCount = 0, errorCount = 0;
    
    for (const [index, ip] of ips.entries()) {
        const cleanIp = ip.trim(); 
        if (!cleanIp) continue;

        // USA A TRADUÇÃO PARA A MENSAGEM DE PROCESSAMENTO
        let processingMsg = translations.log_processing || 'Processando {index}/{total}: {ip}... ';
        processingMsg = processingMsg.replace('{index}', index + 1).replace('{total}', ips.length).replace('{ip}', cleanIp);
        logElement.innerHTML += processingMsg;

        try {
            const response = await fetch('/api/servers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ip: cleanIp }) });
            const result = await response.json();
            
            if (response.ok) {
                const successMsg = translations.log_success || 'Sucesso!';
                logElement.innerHTML += `<span style="color:var(--accent-green);">${successMsg}</span><br>`;
                successCount++;
            } else {
                let failureMsg = translations.log_failure || 'Falha ({error})';
                failureMsg = failureMsg.replace('{error}', result.detail);
                logElement.innerHTML += `<span style="color:var(--accent-red);">${failureMsg}</span><br>`;
                errorCount++;
            }
        } catch (error) {
            const errorMsg = translations.log_connection_error || 'Erro de conexão';
            logElement.innerHTML += `<span style="color:var(--accent-red);">${errorMsg}</span><br>`;
            errorCount++;
        }
        logElement.scrollTop = logElement.scrollHeight;
    }

    // USA A TRADUÇÃO PARA O SUMÁRIO
    let summaryMsg = translations.log_summary || '<b>Concluído!</b> Adicionados: {success}, Falhas: {errorCount}.';
    summaryMsg = summaryMsg.replace('{success}', successCount).replace('{errorCount}', errorCount);
    logElement.innerHTML += `<hr style="border-color:var(--border-color);margin:12px 0;"><br>${summaryMsg}`;
    
    logElement.scrollTop = logElement.scrollHeight;
    if (button) button.disabled = false;
    await fetchAndUpdateServers();
}
        const singleAddForm = document.getElementById('single-add-form');
        if(singleAddForm) singleAddForm.addEventListener('submit', async (e) => { e.preventDefault(); const ip = document.getElementById('single-ip-input').value.trim(); await processIpList([ip], document.getElementById('single-add-log'), singleAddForm); document.getElementById('single-ip-input').value = ''; });
        const bulkAddForm = document.getElementById('bulk-add-form');
        if(bulkAddForm) bulkAddForm.addEventListener('submit', async (e) => { e.preventDefault(); const ips = document.getElementById('bulk-ips-input').value.trim().split('\n'); await processIpList(ips, document.getElementById('bulk-log'), bulkAddForm); document.getElementById('bulk-ips-input').value = ''; });
        const fileInput = document.getElementById('file-import-input');
        if(fileInput) { fileInput.addEventListener('change', (e) => { const file = e.target.files[0]; if (!file) return; const reader = new FileReader(); reader.onload = async (event) => { const ips = event.target.result.trim().split('\n'); await processIpList(ips, document.getElementById('file-log'), fileInput.closest('.add-option-card')); }; reader.readAsText(file); fileInput.value = ''; }); }
    }

// --- FUNÇÃO PRINCIPAL DE INICIALIZAÇÃO DA APLICAÇÃO ---
function exportToCsv(filename, rows) {
    // Converte uma array de arrays em uma string formatada em CSV
    const processRow = (row) => {
        let finalVal = '';
        for (let j = 0; j < row.length; j++) {
            let innerValue = row[j] === null || row[j] === undefined ? '' : String(row[j]);
            if (row[j] instanceof Date) {
                innerValue = row[j].toISOString();
            }
            let result = innerValue.replace(/"/g, '""');
            if (result.search(/("|,|\n)/g) >= 0) {
                result = '"' + result + '"';
            }
            if (j > 0) {
                finalVal += ',';
            }
            finalVal += result;
        }
        return finalVal + '\n';
    };

    let csvFile = rows.map(processRow).join('');
    const blob = new Blob([csvFile], { type: 'text/csv;charset=utf-8;' });
    
    // Cria um link temporário para forçar o download
    const link = document.createElement("a");
    if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}

        // 1. Lógica para o botão de resetar o zoom
        const contextualResetBtn = document.getElementById('contextual-reset-zoom-btn');
        if (contextualResetBtn) {
            contextualResetBtn.addEventListener('click', () => {
                if (historyChart) {
                    historyChart.resetZoom();
                    contextualResetBtn.classList.add('hidden'); // Esconde o botão após o clique
                }
            });
        }

        // 2. Lógica para abrir/fechar o menu de ações (dropdown)
        const exportActionsBtn = document.getElementById('export-actions-btn');
        const exportDropdownMenu = document.getElementById('export-dropdown-menu');
        if (exportActionsBtn && exportDropdownMenu) {
            exportActionsBtn.addEventListener('click', (event) => {
                event.stopPropagation(); // Impede que o clique se propague e feche o menu
                exportDropdownMenu.classList.toggle('hidden');
            });
        }

        // 3. Lógica para salvar o gráfico como imagem
        const saveImageBtn = document.getElementById('save-chart-image-btn');
    if (saveImageBtn) {
        // ...e SUBSTITUA todo o seu event listener por este:
        saveImageBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (!historyChart || !currentOpenServer) {
                alert("Gráfico não carregado ou nenhum servidor selecionado.");
                return;
            }

            // --- INÍCIO DA NOVA LÓGICA DE EXPORTAÇÃO ---

            const originalCanvas = historyChart.canvas;
            const chartDataURL = originalCanvas.toDataURL('image/png'); // Pega a imagem do gráfico
            const img = new Image();
            img.src = chartDataURL;

            // Só continuamos depois que a imagem do gráfico estiver pronta
            img.onload = () => {
                // 1. Cria um novo canvas com espaço para o cabeçalho e bordas
                const PADDING = 30;
                const HEADER_HEIGHT = 90;
                const newCanvas = document.createElement('canvas');
                newCanvas.width = originalCanvas.width + (PADDING * 2);
                newCanvas.height = originalCanvas.height + HEADER_HEIGHT + PADDING;
                const ctx = newCanvas.getContext('2d');

                // 2. Desenha o fundo usando a cor do card da sua UI
                const bgColor = getComputedStyle(document.documentElement).getPropertyValue('--bg-card').trim();
                ctx.fillStyle = bgColor;
                ctx.fillRect(0, 0, newCanvas.width, newCanvas.height);

                // 3. Escreve as informações no cabeçalho
                const titleColor = getComputedStyle(document.documentElement).getPropertyValue('--text-primary').trim();
                const subtitleColor = getComputedStyle(document.documentElement).getPropertyValue('--text-secondary').trim();
                const serverName = (currentOpenServer.nome_customizado || currentOpenServer.nome_servidor || currentOpenServer.ip_servidor).replace(/§[0-9a-fk-or]/gi, '');
                
                // Nome do Servidor
                ctx.fillStyle = titleColor;
                ctx.font = "bold 22px 'Inter', sans-serif";
                ctx.textAlign = 'center';
                ctx.fillText(serverName, newCanvas.width / 2, PADDING + 28);
                
                // Período de tempo do gráfico
                const minDate = new Date(historyChart.scales.x.min).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
                const maxDate = new Date(historyChart.scales.x.max).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
                ctx.fillStyle = subtitleColor;
                ctx.font = "15px 'Inter', sans-serif";
                ctx.fillText(`Período: ${minDate} a ${maxDate}`, newCanvas.width / 2, PADDING + 58);

                // 4. Desenha a imagem do gráfico no novo canvas
                ctx.drawImage(img, PADDING, HEADER_HEIGHT);
                
                // 5. Gera o nome do arquivo e dispara o download
                const link = document.createElement('a');
                const date = new Date().toISOString().split('T')[0];
                const cleanServerName = serverName.replace(/[^a-z0-9]/gi, '_');
                const fileName = `BlockSpy_Report_${cleanServerName}_${date}.png`;

                link.href = newCanvas.toDataURL('image/png');
                link.download = fileName;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            };
        });
    }
        
        // 4. Lógica para exportar os dados do gráfico como CSV
        const exportCsvBtn = document.getElementById('export-chart-csv-btn');
        if (exportCsvBtn) {
            exportCsvBtn.addEventListener('click', (e) => {
                e.preventDefault();
                if (!lastHistoryData || !lastHistoryData.length || !currentOpenServer) {
                    alert("Não há dados de histórico para exportar.");
                    return;
                }

                const date = new Date().toISOString().split('T')[0];
                const serverName = (currentOpenServer.nome_customizado || currentOpenServer.ip_servidor).replace(/[^a-z0-9]/gi, '_');
                const fileName = `historico_${serverName}_${date}.csv`;

                const headers = ['timestamp_utc', 'jogadores_online', 'ping', 'lotacao_percentual', 'variacao_jogadores'];
                const rows = [headers];

                lastHistoryData.forEach(row => {
                    rows.push([
                        row.timestamp,
                        row.jogadores_online,
                        row.ping,
                        row.lotacao_percentual,
                        row.variacao_jogadores
                    ]);
                });
                
                exportToCsv(fileName, rows);
            });
        }
        
        // Listener global para fechar o dropdown se clicar fora dele
        window.addEventListener('click', () => {
            if (exportDropdownMenu && !exportDropdownMenu.classList.contains('hidden')) {
                exportDropdownMenu.classList.add('hidden');
            }
        });

        // --- LÓGICA FINAL DE CARREGAMENTO ---
        await fetchAndUpdateServers();
        updateIntervalId = setInterval(fetchAndUpdateServers, UPDATE_INTERVAL);

    const shutdownBtn = document.getElementById('shutdown-button');
if (shutdownBtn) {
    shutdownBtn.addEventListener('click', (e) => {
        e.preventDefault();

        const title = translations.modal_shutdown_title || 'Desligar Aplicação';
        const message = translations.modal_shutdown_message || 'Tem certeza que deseja fechar o BlockSpy? O monitoramento será interrompido.';

        showConfirmModal(title, message, () => {
            // A lógica de desligamento que já estava aqui
            fetch('/api/shutdown', { method: 'POST' })
                .catch(err => console.error('Isso é esperado: O servidor foi desligado antes de responder.', err));

            window.close();

            setTimeout(() => {
                document.body.innerHTML = '<h1 style="text-align:center; padding-top: 40vh; font-family: sans-serif; color: #ccc;">O BlockSpy foi desligado.<br>Você já pode fechar esta aba.</h1>';
            }, 500);
        });
        // ------------------------------------
    });
}
function renderEventTimeline(events) {
    const container = document.getElementById('timeline-container');
    if (!container) return;

    const titleElement = container.closest('.card-timeline').querySelector('h2');
    if (titleElement) {
        titleElement.textContent = translations.timeline_title || 'Linha do Tempo';
    }

    container.innerHTML = '';
    if (!events || events.length === 0) {
        const emptyMsg = translations.timeline_no_events || 'Nenhum evento registrado recentemente.';
        container.innerHTML = `<p class="empty-message">${emptyMsg}</p>`;
        return;
    }

    const iconMap = {
        'SERVIDOR_ONLINE': '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>',
        'SERVIDOR_OFFLINE': '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>',
        'JOGADOR_ENTROU': '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path><polyline points="10 17 15 12 10 7"></polyline><line x1="15" y1="12" x2="3" y2="12"></line></svg>',
        'JOGADOR_SAIU': '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>',
        'NOVO_PICO_JOGADORES': '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="7"></circle><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"></polyline></svg>',
        'VERSAO_ALTERADA': '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="6" y1="3" x2="6" y2="15"></line><circle cx="18" cy="6" r="3"></circle><circle cx="6" cy="18" r="3"></circle><path d="M18 9a9 9 0 0 1-9 9"></path></svg>'
    };

    events.forEach(event => {
        if (!event || !event.timestamp || !event.tipo_evento) return;
        const item = document.createElement('div');
        item.className = 'timeline-item';
        item.dataset.eventType = event.tipo_evento;
        
        const timestamp = new Date(event.timestamp);
        if (isNaN(timestamp.getTime())) return;

        const localeCode = currentLangCode === 'en' ? 'en-US' : 'pt-BR';
        const formattedTime = timestamp.toLocaleTimeString(localeCode, { hour: '2-digit', minute: '2-digit' });
        const formattedDate = timestamp.toLocaleDateString(localeCode, { day: '2-digit', month: 'short' });
        
        const icon = iconMap[event.tipo_evento] || '•';

        let detailsText = event.detalhes || '';
        const detailsOriginal = event.detalhes || ''; // Guarda o texto original

        // ---- LÓGICA DE TRADUÇÃO MAIS SEGURA ----
        try {
            switch(event.tipo_evento) {
                case 'SERVIDOR_ONLINE': {
                    const match = detailsOriginal.match(/\d+/);
                    detailsText = (translations.event_server_online || detailsOriginal).replace('{count}', match ? match[0] : '??');
                    break;
                }
                case 'SERVIDOR_OFFLINE':
                    detailsText = translations.event_server_offline || detailsOriginal;
                    break;
                case 'JOGADOR_ENTROU': {
                    const player = detailsOriginal.match(/'([^']+)'/); // Pega o nome entre aspas simples
                    detailsText = (translations.event_player_join || detailsOriginal).replace('{player}', player ? player[1] : '??');
                    break;
                }
                case 'JOGADOR_SAIU': {
                    const player = detailsOriginal.match(/'([^']+)'/);
                    detailsText = (translations.event_player_leave || detailsOriginal).replace('{player}', player ? player[1] : '??');
                    break;
                }
                case 'NOVO_PICO_JOGADORES': {
                    const match = detailsOriginal.match(/\d+/);
                    detailsText = (translations.event_new_peak || detailsOriginal).replace('{count}', match ? match[0] : '??');
                    break;
                }
                case 'VERSAO_ALTERADA': {
                    const version = detailsOriginal.split("'")[1]; // Pega a versão entre aspas simples
                    detailsText = (translations.event_version_change || detailsOriginal).replace('{version}', version || '??');
                    break;
                }
            }
        } catch (e) {
            console.warn("Não foi possível traduzir o detalhe do evento, usando texto original.", e);
            detailsText = detailsOriginal; // Se tudo der errado, usa o texto original.
        }
        // ----------------------------------------------------

        item.innerHTML = `
            <div class="timeline-item-icon">${icon}</div>
            <div class="timeline-item-timestamp">${formattedDate}, ${formattedTime}</div>
            <div class="timeline-item-details"></div>
        `;
        item.querySelector('.timeline-item-details').textContent = detailsText;
        container.appendChild(item);
    });
}

async function initializeApp() {
    // Primeiro, carrega o idioma para que a variável 'translations' esteja pronta.
    const initialLang = localStorage.getItem('language') || 'pt';
    await setLanguage(initialLang);

    try {
        // Inicia os sistemas de base
        await appCache.init();
        setupTheme();
        setupNavigation();
        
        // Configura os listeners para cada parte da UI
        setupDashboardControls();
        setupAddForms();
        setupCardActions();
        setupSettingsPage(); // Esta função agora também cuida dos botões de idioma

        // ---- LÓGICA DO BOTÃO DE DESLIGAR MOVIDA PARA CÁ ----
        const shutdownBtn = document.getElementById('shutdown-button');
        if (shutdownBtn) {
            shutdownBtn.addEventListener('click', (e) => {
                e.preventDefault();
                
                const title = translations.modal_shutdown_title || 'Desligar Aplicação';
                const message = translations.modal_shutdown_message || 'Tem certeza que deseja fechar o BlockSpy?';
                
                showConfirmModal(title, message, () => {
                    fetch('/api/shutdown', { method: 'POST' })
                        .catch(err => console.error('Isso é esperado: O servidor foi desligado antes de responder.', err));

                    window.close();

                    setTimeout(() => {
                        document.body.innerHTML = '<h1 style="text-align:center; padding-top: 40vh; font-family: sans-serif; color: #ccc;">O BlockSpy foi desligado.<br>Você já pode fechar esta aba.</h1>';
                    }, 500);
                });
            });
        }
        // ----------------------------------------------------

        // Finalmente, busca os dados e inicia o monitoramento
        await fetchAndUpdateServers();
        updateIntervalId = setInterval(fetchAndUpdateServers, UPDATE_INTERVAL);
        
    } catch (error) {
        console.error("Erro fatal na inicialização do script:", error);
        if (serverListContainer) serverListContainer.innerHTML = '<p class="empty-message">Ocorreu um erro crítico. Verifique o console.</p>';
    }
}

initializeApp();
})