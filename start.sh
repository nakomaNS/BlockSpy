#!/bin/bash

# --- Funções de Cor ---
set_blue() { tput setaf 6; }
set_green() { tput setaf 2; }
set_red() { tput setaf 1; }
set_bold() { tput bold; }
reset_color() { tput sgr0; }

# --- PONTO DE ENTRADA DO SCRIPT ---
echo "[BlockSpy] Iniciando lançador..."

# --- VERIFICAÇÃO #1: O PYTHON EXISTE? ---
if ! command -v python3 &> /dev/null; then
    set_red; echo "[ALERTA] O comando 'python3' não foi encontrado no seu sistema."; reset_color;
    echo "O BlockSpy precisa de Python 3 para funcionar."
    
    set_blue; read -p "Deseja que o script tente instalar 'python3' e 'python3-venv' usando 'sudo apt'? (y/n): " choice; reset_color;
    
    case "$choice" in 
      y|Y ) 
        echo "[INFO] Tentando instalar pacotes essenciais. Isso pode pedir sua senha de superusuário (sudo)."
        
        sudo apt update && sudo apt install -y python3 python3-venv
        
        if [ $? -eq 0 ]; then
            set_green; echo "[SUCESSO] Python instalado! Por favor, rode o script './start.sh' novamente para continuar."; reset_color;
            exit 0
        else
            set_red; echo "[ERRO] A instalação automática falhou. Por favor, instale 'python3' e 'python3-venv' manualmente e tente de novo."; reset_color;
            exit 1
        fi
        ;;
      * ) 
        set_red; echo "[INFO] Instalação cancelada. O script não pode continuar sem Python."; reset_color;
        exit 1
        ;;
    esac
fi

# --- VERIFICAÇÃO #2: O VENV EXISTE? ---
if [ ! -d "venv" ]; then
    echo "[INFO] Ambiente virtual não encontrado. Criando agora..."
    python3 -m venv venv
    
    if [ $? -ne 0 ]; then
     set_red; echo "[ERRO] O pacote para criar ambientes virtuais (venv) não está instalado."; reset_color;
        
        PY_VERSION=$(python3 --version 2>/dev/null | cut -d ' ' -f 2 | cut -d '.' -f 1,2)
        
        if [ -n "$PY_VERSION" ]; then
            PACKAGE_NAME="python${PY_VERSION}-venv"
            
            set_blue; read -p "Deseja que o script tente instalar '${PACKAGE_NAME}' agora usando 'sudo'? (y/n): " choice; reset_color;
            
            case "$choice" in 
              y|Y ) 
                echo "[INFO] Tentando instalar ${PACKAGE_NAME}. Você precisará digitar sua senha de superusuário (sudo)."
                sudo apt update && sudo apt install -y "${PACKAGE_NAME}"
                
                if [ $? -eq 0 ]; then
                    set_green; echo "[SUCESSO] Pacote instalado! Tentando criar o ambiente virtual novamente..."; reset_color;
                    python3 -m venv venv
                    if [ $? -ne 0 ]; then
                        set_red; echo "[ERRO] A criação do ambiente virtual falhou de novo. Por favor, verifique o erro acima e tente resolver manualmente."; reset_color;
                        exit 1
                    fi
                else
                    set_red; echo "[ERRO] A instalação do pacote falhou. Por favor, tente instalar '${PACKAGE_NAME}' manualmente e rode o script de novo."; reset_color;
                    exit 1
                fi
                ;;
              * ) 
                set_red; echo "[INFO] Instalação cancelada pelo usuário. O script não pode continuar."; reset_color;
                exit 1
                ;;
            esac
        else
            set_red; echo "Não foi possível detectar a versão do Python. Por favor, instale o pacote 'python3-venv' manualmente."; reset_color;
            exit 1
        fi
    fi
fi

# --- O resto do script (check_dependencies, show_menu, etc.) continua aqui ---
# ... (cole o resto do seu script funcional aqui)
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
        ./venv/bin/pip install -r "$REQUIREMENTS_FILE"; reset_color
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
██████╗ ██╗     ██████╗  ██████╗██╗  ██╗     ███████╗██████╗ ██╗   ██╗
██╔══██╗██║     ██╔═══██╗██╔════╝██║ ██╔╝     ██╔════╝██╔══██╗╚██╗ ██╔╝
██████╔╝██║     ██║   ██║██║     █████╔╝      ███████╗██████╔╝ ╚████╔╝ 
██╔══██╗██║     ██║   ██║██║     ██╔═██╗      ╚════██║██╔═══╝   ╚██╔╝  
██████╔╝███████╗╚██████╔╝╚██████╗██║  ██╗     ███████║██║        ██║   
╚═════╝ ╚══════╝ ╚═════╝  ╚═════╝╚═╝  ╚═╝     ╚══════╝╚═╝        ╚═╝   
EOF
    reset_color; echo ""; set_green; echo "   Bem-vindo ao Lançador do BlockSpy!"; reset_color
    echo "--------------------------------------------"
    echo "   1) Iniciar o Servidor"
    echo "   2) Sair (ou pressione CTRL+C)"
    echo "--------------------------------------------"
    read -p "   Sua escolha: " choice
    case "$choice" in 1) start_application ;; 2) echo "Operação cancelada."; exit 0 ;; esac
}

start_application() {
    echo ""
    echo "[INFO] Iniciando o servidor Uvicorn em segundo plano..."
    ./venv/bin/python3 -m uvicorn blockspy.web.main:app &
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

# --- Execução Principal ---
check_dependencies
show_menu
