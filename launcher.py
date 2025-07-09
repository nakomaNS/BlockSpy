import uvicorn
import webbrowser
import threading
import time
import sys
import os

# --- INÍCIO DA CORREÇÃO DE CAMINHO PARA O .EXE ---
# Este bloco PRECISA ser o primeiro a ser executado.
# Ele corrige o "mapa" de pastas para que o Python encontre seu pacote.
if hasattr(sys, '_MEIPASS'):
    sys.path.append(sys._MEIPASS)
# --- FIM DA CORREÇÃO DE CAMINHO ---

# --- INÍCIO DOS IMPORTS DO PROJETO ---
# Agora que o caminho está corrigido, podemos importar com segurança.
# Importamos o objeto 'app' diretamente, em vez de usar uma string.
from blockspy.web.main import app
from blockspy.utils import get_persistent_data_path
# --- FIM DOS IMPORTS DO PROJETO ---

# --- INÍCIO DA LÓGICA DE LOG PARA O .EXE ---
# Este bloco só é executado quando o programa está compilado com PyInstaller
if hasattr(sys, '_MEIPASS'):
    try:
        log_path = get_persistent_data_path('blockspy.log')
        log_file = open(log_path, 'a', encoding='utf-8')
        sys.stdout = log_file
        sys.stderr = log_file
    except Exception as e:
        print(f"Falha ao configurar o log em arquivo: {e}")
# --- FIM DA LÓGICA DE LOG ---


def run_server():
    """Esta função apenas roda o servidor Uvicorn."""
    # Passamos o objeto 'app' importado diretamente.
    # Isso é mais robusto e evita que o Uvicorn se perca.
    uvicorn.run(app, host="127.0.0.1", port=8000, log_level="info")

if __name__ == '__main__':
    print("Iniciando BlockSpy...")

    server_thread = threading.Thread(target=run_server)
    server_thread.daemon = True 
    server_thread.start()
    
    print("Servidor iniciando, aguarde...")
    time.sleep(3)
    
    print("Abrindo a interface no navegador...")
    webbrowser.open("http://127.0.0.1:8000")
    
    server_thread.join()

# Last update 07/08/2025 21:17:37
