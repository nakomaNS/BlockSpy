#!/bin/bash

# --- Funções de Cor (sem alterações) ---
set_blue() { tput setaf 6; }
set_green() { tput setaf 2; }
set_red() { tput setaf 1; }
set_bold() { tput bold; }
reset_color() { tput sgr0; }

# --- Verificação e Criação do Ambiente Virtual ---
if [ ! -d "venv" ]; then
    echo "[INFO] Ambiente virtual não encontrado. Criando agora..."
    # Usamos python3 para ser mais explícito em sistemas Unix
    python3 -m venv venv
    if [ $? -ne 0 ]; then
        set_red; echo "[ERRO] Falha ao criar o ambiente virtual. Verifique se o Python 3 está instalado."; reset_color;
        exit 1
    fi
fi

# --- O resto do script continua a partir daqui ---
# Ativa o ambiente virtual para o restante do script
source venv/bin/activate

# (As funções check_dependencies, show_menu e start_application continuam exatamente as mesmas de antes)

check_dependencies() {
    REQUIREMENTS_FILE="requirements.txt"
    HASH_FILE=".deps_hash"
    if [ ! -f "$REQUIREMENTS_FILE" ]; then
        set_red; echo "[ERRO] Arquivo '$REQUIREMENTS_FILE' não encontrado!"; reset_color; exit 1
    fi
    current_hash=$(md5sum "$REQUIREMENTS_FILE" | awk '{print $1}')
    stored_hash=""; if [ -f "$HASH_FILE" ]; then stored_hash=$(cat "$HASH_FILE"); fi
    if [ "$current_hash" != "$stored_hash" ]; then
        echo "[INFO] Instalando/Atualizando dependências..."; set_blue
        pip install -r "$REQUIREMENTS_FILE"; reset_color
        if [ $? -eq 0 ]; then
            echo "$current_hash" > "$HASH_FILE"; set_green; echo "[INFO] Dependências instaladas!"; reset_color
        else
            set_red; echo "[ERRO] Falha ao instalar dependências."; reset_color; exit 1
        fi; echo "--------------------------------------------"
    else
        set_green; echo "[INFO] Dependências já estão atualizadas."; reset_color
    fi
}

show_menu() {
    clear; set_blue; set_bold
    cat << "EOF"
██████╗ ██╗      ██████╗  ██████╗██╗  ██╗    ███████╗██████╗ ██╗   ██╗
██╔══██╗██║     ██╔═══██╗██╔════╝██║ ██╔╝    ██╔════╝██╔══██╗╚██╗ ██╔╝
██████╔╝██║     ██║   ██║██║     █████╔╝     ███████╗██████╔╝ ╚████╔╝ 
██╔══██╗██║     ██║   ██║██║     ██╔═██╗     ╚════██║██╔═══╝   ╚██╔╝  
██████╔╝███████╗╚██████╔╝╚██████╗██║  ██╗    ███████║██║        ██║   
╚═════╝ ╚══════╝ ╚═════╝  ╚═════╝╚═╝  ╚═╝    ╚══════╝╚═╝        ╚═╝                                       
EOF
    reset_color; echo ""; set_green; echo "    Bem-vindo ao Lançador do BlockSpy!"; reset_color
    echo "--------------------------------------------"
    echo "    1) Iniciar o Servidor"
    echo "    *) Sair (ou pressione CTRL+C)"
    echo "--------------------------------------------"
    read -p "    Sua escolha: " choice
    case "$choice" in 1) start_application ;; *) echo "Operação cancelada."; exit 0 ;; esac
}

start_application() {
    echo ""
    echo "[INFO] Iniciando o servidor Uvicorn em segundo plano..."
    uvicorn web.main:app &
    SERVER_PID=$!
    echo "[INFO] Servidor iniciado (PID: $SERVER_PID). Aguardando para abrir o navegador..."
    sleep 1.5
    echo "[INFO] Abrindo o navegador..."
    if command -v open > /dev/null; then open http://127.0.0.1:8000; elif command -v xdg-open > /dev/null; then xdg-open http://127.0.0.1:8000; fi
    echo "--------------------------------------------------------"
    echo "✅ Servidor no ar! Os logs aparecerão abaixo."
    echo "   Pressione CTRL+C para parar o servidor a qualquer momento."
    echo "--------------------------------------------------------"
    wait $SERVER_PID
}

# --- Ponto de Entrada do Script ---
echo "[BlockSpy] Iniciando lançador..."
check_dependencies
show_menu