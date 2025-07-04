document.addEventListener('DOMContentLoaded', async () => {
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
    const UPDATE_INTERVAL = 10000;
    const DETAILS_UPDATE_INTERVAL = 45000;
    let allServersCache = [];
    let currentOpenServer = null;
    let historyChart = null;
    let heatmapChart = null;
    let consoleSocket = null;
    let updateIntervalId = null; 
    let detailsUpdateIntervalId = null;
    let lastHistoryData = null;

    function formatServerType(type) {
        if (type === 'Original') return 'Original 🛡️';
        if (type === 'Pirata') return 'Pirata 🏴‍☠️';
        return 'Indefinido';
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
        const themeToggle = document.getElementById('theme-toggle');
        const videoDark = document.getElementById('video-dark');
        const videoLight = document.getElementById('video-light');
        function applyTheme(theme) {
            document.body.classList.toggle('light-mode', theme === 'light');
            if (themeToggle) themeToggle.checked = (theme === 'light');
            if (videoDark) videoDark.style.opacity = (theme === 'light' ? '0' : '1');
            if (videoLight) videoLight.style.opacity = (theme === 'light' ? '1' : '0');
        }
        if (themeToggle) {
            themeToggle.addEventListener('change', () => {
                const newTheme = themeToggle.checked ? 'light' : 'dark';
                localStorage.setItem('theme', newTheme);
                applyTheme(newTheme);
                if (historyChart && lastHistoryData && views['details'].style.display === 'block') {
                    if(historyChart) historyChart.destroy();
                    historyChart = null;
                    renderHistoryChart(lastHistoryData);
                }
            });
        }
        const savedTheme = localStorage.getItem('theme') || 'dark';
        applyTheme(savedTheme);
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
            
            if (server.pausado) { statusText = 'Pausado'; statusClass = 'paused'; card.classList.add('paused');
            } else if (isOnline) { statusText = 'Online'; statusClass = 'online'; card.classList.remove('offline');
            } else if (server.status === 'pending') { statusText = 'Verificando...'; statusClass = 'paused'; card.classList.add('offline'); 
            } else { statusText = 'Offline'; statusClass = 'offline'; card.classList.add('offline'); }
            
            const displayName = server.nome_customizado || server.nome_servidor || server.ip_servidor;
            
            const iconHTML = (server.tem_icone_customizado == 1)
                ? `<div class="server-icon" data-lazy-type="icon" data-ip="${server.ip_servidor}"><span>${(displayName || '?').replace(/§[0-9a-fk-or]/gi, '').charAt(0).toUpperCase()}</span></div>`
                : `<div class="server-icon" data-ip="${server.ip_servidor}"><img src="/static/grass.png" alt="Ícone padrão"></div>`;
            
            const flagImg = server.country_code ? `<img src="https://flagcdn.com/w20/${server.country_code.toLowerCase()}.png" alt="${server.localizacao}" class="flag-icon">` : '';
            const locationHTML = `<span>${flagImg} ${server.localizacao || 'Buscando...'}</span>`;

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
                        <button class="card-action-btn edit-btn" title="Editar" data-ip="${server.ip_servidor}" data-action="edit">${editIconSVG()}</button>
                        <button class="card-action-btn pause-btn" title="${server.pausado ? 'Reativar' : 'Pausar'}" data-ip="${server.ip_servidor}" data-action="pause">${server.pausado ? playIconSVG() : pauseIconSVG()}</button>
                        <button class="card-action-btn delete-btn" title="Remover" data-ip="${server.ip_servidor}" data-action="delete">${removeIconSVG()}</button>
                    </div>
                </div>
                <div class="player-info">
                    <span>Ping: ${isOnline ? server.ping + 'ms' : '--'}</span>
                    <span class="status-badge ${statusClass}">${statusText}</span>
                </div>
                <div class="info-details">
                     <div class="info-row"><span>Tipo:</span><span>${formatServerType(server.tipo_servidor)}</span></div>
                     <div class="info-row"><span>Jogadores:</span><span>${isOnline ? `${server.jogadores_online} / ${server.jogadores_maximos}` : '--'}</span></div>
                     <div class="info-row"><span>Versão:</span><span>${isOnline ? server.versao : '--'}</span></div>
                     <div class="info-row"><span>Local:</span>${locationHTML}</div>
                </div>`;

            const motdContainer = card.querySelector('.server-details h3');
            renderMotdInElement(displayName, motdContainer);
            
            serverListContainer.appendChild(card);
        });
        setupIntersectionObserver();
        serverListContainer.scrollTop = preservedScroll;
    }
    
    let intersectionObserver = null;
    function setupIntersectionObserver() {
        const lazyElements = document.querySelectorAll('[data-lazy-type="icon"]');
        if (intersectionObserver) intersectionObserver.disconnect();
        intersectionObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) { const element = entry.target; loadIcon(element); observer.unobserve(element); }
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
    connectingLine.textContent = 'Conectando ao console do servidor...';
    logDisplay.appendChild(connectingLine);

    const wsProtocol = window.location.protocol === 'https' ? 'wss' : 'ws';
    const wsUrl = `${wsProtocol}://${window.location.host}/ws/console/${serverIp}`;
    
    consoleSocket = new WebSocket(wsUrl);

    consoleSocket.onopen = () => {
        console.log('Conexão WebSocket estabelecida.');
    };

    consoleSocket.onmessage = (event) => {
        if (logDisplay.textContent.includes('Conectando ao console')) {
            logDisplay.innerHTML = '';
        }
        
        const msg = JSON.parse(event.data);

        // --- DIAGNÓSTICO JAVASCRIPT ---
        console.log("MENSAGEM BRUTA RECEBIDA:", event.data);
        console.log("MENSAGEM APÓS PARSE:", msg);
        console.log("TIPO DE DADO (msg.data):", typeof msg.data);
        console.log("CONTEÚDO (msg.data):", msg.data);
        // --- FIM DO DIAGNÓSTICO ---

        const logLine = document.createElement('div');
        logLine.textContent = msg.data;

        // Aplica o estilo baseado no tipo da mensagem
        switch (msg.type) {
            case 'status':
                logLine.className = 'log-status';
                if (msg.data.includes('ao vivo')) {
                    consoleTitle.innerHTML = '🔴 Console ao Vivo';
                } else if (msg.data.includes('RCON')) {
                    consoleTitle.innerHTML = '📟 Console RCON';
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
        consoleTitle.innerHTML = '🔌 Console Desconectado';
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
            applyFilterAndSort();
        } catch (error) { console.error("Falha ao buscar dados dos servidores:", error); if(serverListContainer) serverListContainer.innerHTML = '<p class="empty-message">Erro ao carregar servidores.</p>';}
    }
    
    async function showDetailsView(serverObject) {
    currentOpenServer = serverObject;
    console.log("%c--- Função showDetailsView INICIADA com este objeto: ---", "color: #3b82f6; font-weight: bold;", serverObject);

    clearInterval(detailsUpdateIntervalId);
    window.showView('details');

    // Mapeamento dos elementos da tela de detalhes
    const nameEl = document.getElementById('details-server-name');
    const ipEl = document.getElementById('details-server-ip');
    const playerListEl = document.getElementById('details-player-list');
    const offlinePlayerListEl = document.getElementById('details-offline-player-list');
    const playerCountEl = document.getElementById('details-player-count');
    const statUptimeEl = document.getElementById('stat-uptime');
    const statPeakEl = document.getElementById('stat-peak');
    const statAvgEl = document.getElementById('stat-avg');

    // Limpeza inicial da tela para dar feedback de carregamento
    if(nameEl) nameEl.textContent = 'Carregando...';
    if(ipEl) ipEl.textContent = '...';
    if(playerListEl) playerListEl.innerHTML = '<li>Carregando...</li>';
    if(offlinePlayerListEl) offlinePlayerListEl.innerHTML = '<li>Carregando...</li>';
    if(playerCountEl) playerCountEl.textContent = 'Jogadores Online';
    if(statUptimeEl) statUptimeEl.textContent = '--';
    if(statPeakEl) statPeakEl.textContent = '--';
    if(statAvgEl) statAvgEl.textContent = '--';

    const serverIp = serverObject.ip_servidor;
    const isRconConfigured = serverObject.rcon_port && serverObject.rcon_password;
    updateConsoleUI(isRconConfigured, serverObject);

    // --- LÓGICA PARA PERÍODO DINÂMICO ---
    const periodSelector = document.querySelector('.chart-period-selector');
    let currentHours = 24; // Padrão inicial

    // Função interna que busca todos os dados e renderiza a tela
    const fetchAndRenderDetails = async (hours = 24) => {
         try {
            // A chamada de history agora usa o parâmetro 'hours'
            const [historyResponse, playersResponse, statsResponse, calendarResponse, eventsResponse] = await Promise.all([
                fetch(`/api/servers/${serverIp}/history?hours=${hours}`),
                fetch(`/api/servers/${serverIp}/players`),
                fetch(`/api/servers/${serverIp}/stats`),
                fetch(`/api/servers/${serverIp}/calendar_heatmap`),
                fetch(`/api/servers/${serverIp}/events`)
            ]);
            
            if (!historyResponse.ok || !playersResponse.ok || !statsResponse.ok || !calendarResponse.ok || !eventsResponse.ok) { 
                throw new Error("Falha em uma das APIs de detalhes."); 
            }
            
            const historyData = await historyResponse.json();
            const playersData = await playersResponse.json();
            const statsData = await statsResponse.json();
            const calendarData = await calendarResponse.json(); 
            const eventsData = await eventsResponse.json();
            
            const displayName = serverObject.nome_customizado || serverObject.nome_servidor || serverObject.ip_servidor;
            if(nameEl) renderMotdInElement(displayName, nameEl);
            if(ipEl) ipEl.textContent = serverObject.ip_servidor;
            
            if(statUptimeEl) statUptimeEl.textContent = `${statsData.uptime_percent}%`;
            if(statPeakEl) statPeakEl.textContent = statsData.peak_players;
            if(statAvgEl) statAvgEl.textContent = statsData.average_players;

            lastHistoryData = historyData;
            renderHistoryChart(historyData);
            renderPlayerLists(playersData.online, playersData.offline);
            renderCalendarHeatmap(calendarData, serverObject.jogadores_maximos);
            renderEventTimeline(eventsData);

        } catch (error) {
            console.error("Erro ao renderizar detalhes:", error);
            if (detailsUpdateIntervalId) {
                clearInterval(detailsUpdateIntervalId);
                detailsUpdateIntervalId = null;
            }
        }
    };
    
    // Lógica para os botões de período
    if (periodSelector) {
        // Clona o nó para remover event listeners antigos e evitar duplicação
        const newSelector = periodSelector.cloneNode(true);
        periodSelector.parentNode.replaceChild(newSelector, periodSelector);

        newSelector.addEventListener('click', (e) => {
            if (e.target.classList.contains('period-btn')) {
                const selectedHours = e.target.dataset.hours;
                
                // Compara string com string para segurança
                if (selectedHours !== String(currentHours)) {
                    currentHours = Number(selectedHours);
                    
                    // Atualiza a classe 'active' nos botões
                    if (newSelector.querySelector('.period-btn.active')) {
                        newSelector.querySelector('.period-btn.active').classList.remove('active');
                    }
                    e.target.classList.add('active');
                    
                    // Busca e renderiza os dados para o novo período
                    fetchAndRenderDetails(currentHours);
                }
            }
        });
    }

    // Chamada inicial para carregar os dados com o período padrão (24h)
    await fetchAndRenderDetails(currentHours);
    
    // Inicia o WebSocket do console
    setupConsole(serverIp);

    // Inicia o intervalo de atualização automática
    if (!detailsUpdateIntervalId) {
        detailsUpdateIntervalId = setInterval(() => fetchAndRenderDetails(currentHours), DETAILS_UPDATE_INTERVAL);
    }
}




    function renderHistoryChart(data) {
    const canvas = document.getElementById('history-chart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const legendContainer = document.getElementById('details-legend-container');

    // 1. Destrói o gráfico antigo, se ele existir. Limpeza total.
    if (historyChart) {
        historyChart.destroy();
        historyChart = null;
    }

    // Limpa a legenda antiga
    if(legendContainer) legendContainer.innerHTML = '';

    // 2. Lida com o caso de não haver dados para o período
    if (!data || data.length === 0) {
        const textColor = getComputedStyle(document.documentElement).getPropertyValue('--text-secondary').trim();
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.font = "16px 'Inter', sans-serif";
        ctx.fillStyle = textColor;
        ctx.textAlign = 'center';
        ctx.fillText("Sem histórico de atividade para exibir neste período.", canvas.width / 2, canvas.height / 2);
        return;
    }

    // 3. Prepara os dados e as cores (sempre)
    const labels = data.map(d => new Date(d.timestamp));
    const pings = data.map(d => d.ping);
    const lotacao = data.map(d => d.lotacao_percentual);
    const variacao = data.map(d => d.variacao_jogadores);
    const jogadores = data.map(d => d.jogadores_online);
    
    const primaryColor = getComputedStyle(document.documentElement).getPropertyValue('--text-primary').trim();
    const gridColor = getComputedStyle(document.documentElement).getPropertyValue('--border-color').trim();
    const textColor = getComputedStyle(document.documentElement).getPropertyValue('--text-secondary').trim();
    const accentBlue = getComputedStyle(document.documentElement).getPropertyValue('--accent-blue').trim();
    const accentGreen = getComputedStyle(document.documentElement).getPropertyValue('--accent-green').trim();
    const accentOrange = getComputedStyle(document.documentElement).getPropertyValue('--accent-orange').trim();
    const textPositive = getComputedStyle(document.documentElement).getPropertyValue('--text-positive').trim();
    const textNegative = getComputedStyle(document.documentElement).getPropertyValue('--text-negative').trim();

    // 4. Cria uma instância totalmente nova do gráfico
    historyChart = new Chart(ctx, {
        // ... (toda a sua configuração de 'data' e 'options' continua aqui, exatamente como antes)
        data: {
            labels: labels,
            datasets: [
                { type: 'bar', label: 'Entrada/Saída', data: variacao, backgroundColor: variacao.map(v => v > 0 ? textPositive : (v < 0 ? textNegative : 'transparent')), borderColor: variacao.map(v => v > 0 ? textPositive : (v < 0 ? textNegative : 'transparent')), barThickness: 4, yAxisID: 'yVariacao', order: 3 },
                { type: 'line', label: 'Lotação (%)', data: lotacao, borderColor: accentOrange, yAxisID: 'yLotacao', tension: 0.4, borderWidth: 3.5, pointRadius: 0, pointHoverRadius: 6, pointBackgroundColor: accentOrange, pointBorderColor: 'white', order: 2 },
                { type: 'line', label: 'Ping (ms)', data: pings, borderColor: accentGreen, yAxisID: 'yPing', tension: 0.4, borderWidth: 3.5, pointRadius: 0, pointHoverRadius: 6, pointBackgroundColor: accentGreen, pointBorderColor: 'white', order: 1 },
                { type: 'line', label: 'Jogadores', data: jogadores, borderColor: accentBlue, backgroundColor: 'transparent', yAxisID: 'yJogadores', tension: 0.4, borderWidth: 3.5, pointRadius: 0, pointHoverRadius: 6, pointBackgroundColor: accentBlue, pointBorderColor: 'white', order: 0 }
            ]
        },
        options: {
            responsive: true,
            clip: false,
            maintainAspectRatio: false,
            animation: { duration: 0 },
            interaction: { intersect: false, mode: 'index' },
            scales: {
                x: { 
                    type: 'time',
                    time: { unit: 'hour', tooltipFormat: 'dd/MM HH:mm', displayFormats: { hour: 'HH:mm', day: 'dd/MM'}},
                    ticks: { color: textColor, maxRotation: 0, autoSkip: true }, 
                    grid: { drawOnChartArea: false, drawBorder: false },
                },
                yPing: { type: 'linear', display: true, position: 'right', title: { display: true, text: 'Ping (ms)', color: textColor }, grid: { drawOnChartArea: false }, min: 0, ticks: { color: textColor } },
                yLotacao: { type: 'linear', display: true, position: 'right', title: { display: true, text: 'Lotação (%)', color: textColor }, min: 0, max: 100, grid: { drawOnChartArea: false }, ticks: { color: textColor, callback: value => value + '%' } },
                yJogadores: { type: 'linear', display: true, position: 'left', title: { display: true, text: 'Jogadores', color: textColor }, min: 0, suggestedMax: 10, grid: { color: gridColor, borderDash: [2, 3], drawBorder: false }, ticks: { color: textColor, precision: 0 } },
                yVariacao: { display: false }
            },
            plugins: {
    legend: { display: false },

    tooltip: { 
        enabled: true,
        events: ['click'],
        backgroundColor: 'var(--bg-card)', 
        titleColor: primaryColor, 
        titleFont: { weight: 'bold', size: 14 }, 
        bodyColor: textColor, 
        borderColor: gridColor, 
        borderWidth: 1, 
        padding: 12, 
        cornerRadius: 8, 
        usePointStyle: true, 
        boxPadding: 4, 
        callbacks: { 
            label: function(context) { 
                let label = context.dataset.label || ''; 
                if (label) { label += ': '; } 
                if (context.parsed.y !== null) { 
                    let value = context.parsed.y; 
                    if (context.dataset.label === 'Lotação (%)') label += value.toFixed(2) + '%'; 
                    else if (context.dataset.label === 'Ping (ms)') label += value + 'ms'; 
                    else if (context.dataset.label.trim() === 'Entrada/Saída') label = (value > 0 ? '+' : '') + value + ' jogadores'; 
                    else label += value; 
                } 
                return label; 
            } 
        } 
    },

    zoom: {
        pan: { enabled: true, mode: 'x', modifierKey: 'ctrl' },
        zoom: { wheel: { enabled: true }, pinch: { enabled: true }, mode: 'x' },

        onZoomComplete: function({chart}) {
            // Mostra o botão de reset após o zoom
            document.getElementById('contextual-reset-zoom-btn').classList.remove('hidden');
        },

        onPanComplete: function({chart}) {
            // Também mostra o botão de reset após arrastar
            document.getElementById('contextual-reset-zoom-btn').classList.remove('hidden');
        }
    }
}}
    });

    // 5. Renderiza a legenda (agora sempre será executada após a criação)
    if (legendContainer) {
        historyChart.data.datasets.forEach((dataset, index) => {
            const legendItem = document.createElement('div');
            legendItem.className = 'legend-item';
            if (historyChart.isDatasetVisible(index) === false) { legendItem.classList.add('hidden'); }
            const symbol = document.createElement('span');
            symbol.className = 'legend-symbol';
            let symbolColor = dataset.borderColor;
            if (dataset.type === 'bar') { symbolColor = textNegative; }
            symbol.style.backgroundColor = symbolColor;
            const text = document.createElement('span');
            text.className = 'legend-text';
            text.innerText = dataset.label;
            legendItem.appendChild(symbol);
            legendItem.appendChild(text);
            legendItem.onclick = () => {
                historyChart.setDatasetVisibility(index, !historyChart.isDatasetVisible(index));
                legendItem.classList.toggle('hidden');
                historyChart.update();
            };
            legendContainer.appendChild(legendItem);
        });
    }
}
    
    function renderPlayerLists(onlinePlayers, offlinePlayers) {
        const onlineListEl = document.getElementById('details-player-list');
        const offlineListEl = document.getElementById('details-offline-player-list');
        const onlineCountEl = document.getElementById('details-player-count');

        if (onlineListEl && onlineCountEl) {
            onlineListEl.innerHTML = '';
            onlineCountEl.textContent = `Jogadores Online (${onlinePlayers.length})`;
            if (onlinePlayers.length === 0) {
                onlineListEl.innerHTML = '<li>Nenhum jogador online.</li>';
            } else {
                onlinePlayers.sort().forEach(player => {
                    const li = document.createElement('li');
                    li.textContent = player;
                    onlineListEl.appendChild(li);
                });
            }
        }

        if (offlineListEl) {
            offlineListEl.innerHTML = '';
            if (offlinePlayers.length === 0) {
                offlineListEl.innerHTML = '<li>Nenhum jogador visto recentemente.</li>';
            } else {
                offlinePlayers.forEach(player => {
                    const li = document.createElement('li');
                    const lastSeenFormatted = formatLastSeen(player.ultima_vez_visto);
                    li.innerHTML = `${player.nome_jogador} <span class="player-offline-time">- ${lastSeenFormatted}</span>`;
                    offlineListEl.appendChild(li);
                });
            }
        }
    }

    function renderCalendarHeatmap(data, maxPlayers) {
    const container = document.getElementById('cal-heatmap');
    if (!container) return;

    container.innerHTML = ''; 

    const dataMap = new Map();
    if (data && data.length > 0) {
        data.forEach(d => {
            const date = new Date(Number(d.timestamp) * 1000);
            const dateString = date.toISOString().split('T')[0];
            dataMap.set(dateString, d.value);
        });
    }

    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth();
    
    const firstDayOfMonth = new Date(currentYear, currentMonth, 1);
    const startingWeekday = firstDayOfMonth.getDay();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

    const grid = document.createElement('div');
    grid.className = 'custom-heatmap-grid';

    const weekdays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    weekdays.forEach(day => {
        const weekdayCell = document.createElement('div');
        weekdayCell.className = 'heatmap-weekday';
        weekdayCell.textContent = day;
        grid.appendChild(weekdayCell);
    });

    for (let i = 0; i < startingWeekday; i++) {
        grid.appendChild(document.createElement('div'));
    }

    const maxValue = dataMap.size > 0 ? Math.max(...dataMap.values(), 1) : 1;
    function getColorForLotação(value, max) {
        if (value <= 0 || !max || max <= 0) return 'rgba(100, 116, 139, 0.2)';
        const lotacao = value / max;
        if (lotacao <= 0.20) return '#6ee7b7';
        else if (lotacao <= 0.45) return 'var(--accent-green)';
        else if (lotacao <= 0.70) return 'var(--accent-yellow)';
        else return 'var(--accent-red)';
    }

    // O loop principal que desenha os dias
    for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(currentYear, currentMonth, day);
        const dayCell = document.createElement('div');
        dayCell.className = 'heatmap-day';
        
        // Apenas processa e colore dias que já aconteceram
        if (date <= today) {
            const dateString = date.toISOString().split('T')[0];
            const value = dataMap.get(dateString) || 0;
            
            dayCell.style.backgroundColor = getColorForLotação(value, maxPlayers);

            const lotacaoPercent = maxPlayers > 0 ? Math.round((value / maxPlayers) * 100) : 0;
            const tooltipText = `${date.toLocaleDateString('pt-BR')}: ${Math.round(value)} jogadores em média (${lotacaoPercent}%)`;
            
            // Adiciona os "escutadores" de mouse para o tooltip global
            dayCell.addEventListener('mouseenter', () => {
                heatmapTooltip.textContent = tooltipText;
                heatmapTooltip.style.display = 'block';
            });
            dayCell.addEventListener('mouseleave', () => {
                heatmapTooltip.style.display = 'none';
            });
            dayCell.addEventListener('mousemove', (e) => {
                // Posiciona o tooltip perto do mouse
                heatmapTooltip.style.left = `${e.clientX + 15}px`;
                heatmapTooltip.style.top = `${e.clientY + 15}px`;

                // Lógica para não deixar o tooltip sair da tela
                const windowWidth = window.innerWidth;
                const tooltipWidth = heatmapTooltip.offsetWidth;
                if ((e.clientX + 15 + tooltipWidth) > windowWidth) {
                    heatmapTooltip.style.left = `${e.clientX - tooltipWidth - 15}px`;
                }
                const windowHeight = window.innerHeight;
                const tooltipHeight = heatmapTooltip.offsetHeight;
                if ((e.clientY + 15 + tooltipHeight) > windowHeight) {
                    heatmapTooltip.style.top = `${e.clientY - tooltipHeight - 15}px`;
                }
            });
        } else {
            // Deixa os dias futuros com a cor base (quase transparente)
             dayCell.style.backgroundColor = 'rgba(100, 116, 139, 0.1)';
             dayCell.style.cursor = 'default';
        }
        
        grid.appendChild(dayCell);
    }

    container.appendChild(grid);
}


    function formatLastSeen(isoString) {
        if (!isoString) return '';
        const now = new Date();
        const lastSeenDate = new Date(isoString);
        const diffSeconds = Math.round((now - lastSeenDate) / 1000);
        
        if (diffSeconds < 60) return 'agora mesmo';
        if (diffSeconds < 3600) return `há ${Math.floor(diffSeconds / 60)} min`;
        if (diffSeconds < 86400) return `há ${Math.floor(diffSeconds / 3600)}h`;
        
        if (now.toDateString() === lastSeenDate.toDateString()) {
            return `hoje às ${lastSeenDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
        }

        const yesterday = new Date(now);
        yesterday.setDate(now.getDate() - 1);
        if (yesterday.toDateString() === lastSeenDate.toDateString()) {
            return `ontem às ${lastSeenDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
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
        saveButton.textContent = 'Verificando...';
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

            saveButton.textContent = 'Salvando...';
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
            saveButton.textContent = 'Salvar Alterações';
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
                    playerTooltip.innerHTML = '<div class="player-tooltip-title">Jogadores Online</div><ul class="player-tooltip-list"><li>Carregando...</li></ul>';
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
                                        list.innerHTML = '<li>Nenhum jogador online.</li>';
                                    }
                                }
                            }
                        })
                        .catch(() => {
                            if (currentHoveredIP === ip) {
                                const list = playerTooltip.querySelector('.player-tooltip-list');
                                if(list) list.innerHTML = '<li>Erro ao buscar.</li>';
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
                if (action === 'delete') showConfirmModal('Remover Servidor', `Tem certeza que deseja remover ${ip}?`, async () => { try { const response = await fetch(`/api/servers/${ip}`, { method: 'DELETE' }); if (response.ok) await fetchAndUpdateServers(); else { const err = await response.json(); alert(`Erro: ${err.detail}`); } } catch (e) { alert("Erro de conexão."); } });
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
        const searchInput = document.getElementById('search-input');
        const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';
        if (searchTerm) { filtered = filtered.filter(server => { const displayName = server.nome_customizado || server.nome_servidor || ''; return displayName.toLowerCase().includes(searchTerm) || server.ip_servidor.toLowerCase().includes(searchTerm); }); }
        filtered.sort((a, b) => {
            let valA = a[currentSort.key] || (currentSort.key === 'jogadores_online' ? -1 : '');
            let valB = b[currentSort.key] || (currentSort.key === 'jogadores_online' ? -1 : '');
            if (typeof valA === 'string') { valA = valA.toLowerCase(); valB = valB.toLowerCase(); }
            if (valA < valB) return currentSort.direction === 'asc' ? -1 : 1;
            if (valA > valB) return currentSort.direction === 'asc' ? 1 : -1;
            return 0;
        });
        renderServerList(filtered);
    }

    function setupDashboardControls() {
        const searchInput = document.getElementById('search-input');
        if(searchInput) searchInput.addEventListener('input', applyFilterAndSort);
        const sortNameBtn = document.getElementById('sort-by-name');
        if(sortNameBtn) sortNameBtn.addEventListener('click', () => { currentSort = { key: 'nome_servidor', direction: 'asc' }; applyFilterAndSort(); });
        const sortPlayersBtn = document.getElementById('sort-by-players');
        if(sortPlayersBtn) sortPlayersBtn.addEventListener('click', () => { currentSort = { key: 'jogadores_online', direction: 'desc' }; applyFilterAndSort(); });
    }

    function setupAddForms() {
        async function processIpList(ips, logElement, form) {
            logElement.innerHTML = ''; logElement.style.display = 'block';
            const button = form.querySelector('button'); if (button) button.disabled = true;
            let successCount = 0, errorCount = 0;
            for (const [index, ip] of ips.entries()) {
                const cleanIp = ip.trim(); if (!cleanIp) continue;
                logElement.innerHTML += `Processando ${index + 1}/${ips.length}: ${cleanIp}... `;
                try {
                    const response = await fetch('/api/servers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ip: cleanIp }), });
                    const result = await response.json();
                    if (response.ok) { logElement.innerHTML += `<span style="color:var(--accent-green);">Sucesso!</span><br>`; successCount++; }
                    else { logElement.innerHTML += `<span style="color:var(--accent-red);">Falha (${result.detail})</span><br>`; errorCount++; }
                } catch (error) { logElement.innerHTML += `<span style="color:var(--accent-red);">Erro de conexão</span><br>`; errorCount++; }
                logElement.scrollTop = logElement.scrollHeight;
            }
            logElement.innerHTML += `<hr style="border-color:var(--border-color);margin:12px 0;"><br><b>Concluído!</b> Adicionados: ${successCount}, Falhas: ${errorCount}.`;
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


// --- FUNÇÃO PRINCIPAL DE INICIALIZAÇÃO DA APLICAÇÃO ---
async function initializeApp() {
    try {
        await appCache.init();
        setupTheme();
        setupNavigation();
        setupDashboardControls();
        setupAddForms();
        setupCardActions();

        // --- EVENT LISTENERS PARA AS NOVAS FUNCIONALIDADES ---

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
            saveImageBtn.addEventListener('click', (e) => {
                e.preventDefault();
                if (!historyChart || !currentOpenServer) {
                    alert("Gráfico não carregado ou nenhum servidor selecionado.");
                    return;
                }

                const date = new Date().toISOString().split('T')[0];
                const serverName = (currentOpenServer.nome_customizado || currentOpenServer.ip_servidor).replace(/[^a-z0-9]/gi, '_');
                const fileName = `grafico_${serverName}_${date}.png`;

                const link = document.createElement('a');
                link.href = historyChart.toBase64Image();
                link.download = fileName;
                link.click();
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

    } catch (error) { 
        console.error("Erro fatal na inicialização do script:", error); 
        if(serverListContainer) serverListContainer.innerHTML = '<p class="empty-message">Ocorreu um erro crítico. Verifique o console.</p>'; 
    }
}
    const shutdownBtn = document.getElementById('shutdown-button');
if (shutdownBtn) {
    shutdownBtn.addEventListener('click', (e) => {
        e.preventDefault();
        
        // 1. CHAMA O MODAL DE CONFIRMAÇÃO QUE VOCÊ JÁ TEM!
        showConfirmModal(
            'Desligar Aplicação', 
            'Tem certeza que deseja fechar o BlockSpy? O monitoramento será interrompido.', 
            () => {
                // Esta função só roda se o usuário clicar em "Confirmar"

                // 2. MANDA O COMANDO DE MORTE PARA O SERVIDOR
                // Não precisamos esperar a resposta, pois o servidor vai morrer no meio do caminho.
                fetch('/api/shutdown', { method: 'POST' })
                    .catch(err => console.error('Isso é esperado: O servidor foi desligado antes de responder.', err));

                // 3. TENTA FECHAR A ABA DO NAVEGADOR
                // Navegadores modernos podem bloquear isso, mas não custa tentar.
                window.close();

                // 4. EXIBE UMA MENSAGEM FINAL DE DESPEDIDA
                // Isso serve como um "plano B" caso a aba não feche sozinha.
                setTimeout(() => {
                    document.body.innerHTML = '<h1 style="text-align:center; padding-top: 40vh; font-family: sans-serif; color: #ccc;">O BlockSpy foi desligado.<br>Você já pode fechar esta aba.</h1>';
                }, 500); // Meio segundo de espera
            }
        );
    });
}
function renderEventTimeline(events) {
    const container = document.getElementById('timeline-container');
    if (!container) {
        console.error("Elemento da timeline '#timeline-container' não encontrado.");
        return;
    }

    container.innerHTML = ''; // Limpa a timeline antiga

    if (!events || events.length === 0) {
        container.innerHTML = '<p class="empty-message">Nenhum evento registrado recentemente.</p>';
        return;
    }
    
    // Mapeia tipos de evento para ícones
    const iconMap = {
        'SERVIDOR_ONLINE': '✅',
        'SERVIDOR_OFFLINE': '❌',
        'JOGADOR_ENTROU': '▶️',
        'JOGADOR_SAIU': '◀️',
        'NOVO_PICO_JOGADORES': '🏆',
        'VERSAO_ALTERADA': '⚙️'
    };

    events.forEach(event => {
        // Checagem de segurança para garantir que o evento é válido
        if (!event || !event.timestamp || !event.tipo_evento) return;

        const item = document.createElement('div');
        item.className = 'timeline-item';

        const timestamp = new Date(event.timestamp);
        // Checagem para garantir que a data é válida
        if (isNaN(timestamp.getTime())) {
            console.error("Timestamp inválido recebido no evento:", event);
            return;
        }

        const formattedTime = timestamp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        const formattedDate = timestamp.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });

        const icon = iconMap[event.tipo_evento] || '•'; // Pega o ícone ou usa um padrão

        // Usamos textContent para os detalhes para evitar problemas com HTML injection
        const detailsText = event.detalhes || '';

        item.innerHTML = `
            <div class="timeline-item-icon">${icon}</div>
            <div class="timeline-item-timestamp">${formattedDate} às ${formattedTime}</div>
            <div class="timeline-item-details"></div>
        `;
        item.querySelector('.timeline-item-details').textContent = detailsText;

        container.appendChild(item);
    });
}

    initializeApp();
});
