import uvicorn
import webbrowser
import threading
import time
import sys
import os
from blockspy.web.main import app, resource_path

# --- INÍCIO DO TRUQUE ---
# Só fazemos isso quando o programa estiver compilado (.exe)
if hasattr(sys, '_MEIPASS'):
    try:
        # Define um caminho para o arquivo de log ao lado do .exe
        log_path = os.path.join(os.path.dirname(sys.executable), 'blockspy.log')
        
        # Abre o arquivo de log e redireciona a saída padrão e de erros para ele
        log_file = open(log_path, 'w', encoding='utf-8')
        sys.stdout = log_file
        sys.stderr = log_file
    except Exception as e:
        # Se até isso der errado, não fazemos nada.
        print(f"Falha ao criar log: {e}")
# --- FIM DO TRUQUE ---


def run_server():
    """Esta função apenas roda o servidor Uvicorn."""
    uvicorn.run("blockspy.web.main:app", host="127.0.0.1", port=8000, log_level="info")

if __name__ == '__main__':
    print("Iniciando BlockSpy...")

    server_thread = threading.Thread(target=run_server)
    server_thread.daemon = True 
    server_thread.start()
    
    print("Servidor iniciando, aguarde...")
    time.sleep(3) # Aumentei para 3s por segurança
    
    print("Abrindo a interface no navegador...")
    webbrowser.open("http://127.0.0.1:8000")
    
    server_thread.join()