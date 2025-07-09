#!/bin/bash

# --- Funções de Cor ---
set_blue() { tput setaf 6; }
set_green() { tput setaf 2; }
set_red() { tput setaf 1; }
set_bold() { tput bold; }
reset_color() { tput sgr0; }

# --- PONTO DE ENTRADA DO SCRIPT ---
echo "[BlockSpy] Iniciando lançador..."

# --- MUDANÇA 1: Mensagens de erro mais genéricas ---
# Removemos a tentativa de instalar com 'apt' e damos uma instrução universal.
if ! command -v python3 &> /dev/null; then
    set_red; echo "[ERRO] O comando 'python3' não foi encontrado no seu sistema."; reset_color;
    echo "O BlockSpy precisa de Python 3.8+ para funcionar."
    echo "Por favor, instale o Python 3 usando o gerenciador de pacotes do seu sistema e tente novamente."
    echo "(Ex: sudo apt install python3, sudo dnf install python3, brew install python)"
    exit 1
fi

# --- VERIFICAÇÃO #2: O VENV EXISTE? ---
if [ ! -d "venv" ]; then
    echo "[INFO] Ambiente virtual não encontrado. Criando agora..."
    python3 -m venv venv
    if [ $? -ne 0 ]; then
        set_red; echo "[ERRO] Falha ao criar o ambiente virtual."; reset_color;
        echo "O módulo 'venv' do Python parece não estar instalado."
        echo "Por favor, instale o pacote correspondente. (Ex: sudo apt install python3-venv)"
        exit 1
    fi
fi

# --- VERIFICAÇÃO DE DEPENDÊNCIAS (Mantida, está perfeita) ---
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

# --- MENU (Mantido) ---
show_menu() {
    clear; set_blue; set_bold
    cat << "EOF"
██████╗ ██╗      ██████╗  ██████╗██╗  ██╗     ███████╗██████╗ ██╗   ██╗
██╔══██╗██║      ██╔═══██╗██╔════╝██║ ██╔╝     ██╔════╝██╔══██╗╚██╗ ██╔╝
██████╔╝██║      ██║   ██║██║     █████╔╝      ███████╗██████╔╝ ╚████╔╝ 
██╔══██╗██║      ██║   ██║██║     ██╔═██╗      ╚════██║██╔═══╝   ╚██╔╝  
██████╔╝███████╗ ╚██████╔╝╚██████╗██║  ██╗     ███████║██║         ██║  
╚═════╝ ╚══════╝ ╚═════╝  ╚═════╝╚═╝  ╚═╝     ╚══════╝╚═╝         ╚═╝  
EOF
    reset_color; echo ""; set_green; echo "   Bem-vindo ao Lançador do BlockSpy!"; reset_color
    echo "--------------------------------------------"
    echo "   1) Iniciar o BlockSpy"
    echo "   2) Sair (ou pressione CTRL+C)"
    echo "--------------------------------------------"
    read -p "   Sua escolha: " choice
    case "$choice" in 1) start_application ;; 2) echo "Operação cancelada."; exit 0 ;; *) show_menu ;; esac
}

# --- MUDANÇA 2: Centralizando a lógica no launcher.py ---
# Agora, esta função apenas chama o script Python que já sabe o que fazer.
start_application() {
    echo ""
    echo "[INFO] Entregando o controle para o launcher.py..."
    echo "--------------------------------------------------------"
    echo "✅ Servidor no ar! Use o botão 'Desligar' na interface para encerrar."
    echo "   Se o navegador não abrir, acesse http://127.0.0.1:8000"
    echo "   Pressione CTRL+C aqui no terminal para forçar o encerramento."
    echo "--------------------------------------------------------"
    
    # Este é o novo comando. Simples e limpo.
    ./venv/bin/python3 launcher.py
}

# --- Execução Principal ---
check_dependencies
show_menu