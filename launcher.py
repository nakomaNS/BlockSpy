import uvicorn
import webbrowser
import threading
import time
import sys
import os

if hasattr(sys, '_MEIPASS'):
    sys.path.append(sys._MEIPASS)

from blockspy.web.main import app
from blockspy.utils import get_persistent_data_path

if hasattr(sys, '_MEIPASS'):
    try:
        log_path = get_persistent_data_path('blockspy.log')
        log_file = open(log_path, 'a', encoding='utf-8')
        sys.stdout = log_file
        sys.stderr = log_file
    except Exception as e:
        print(f"Falha ao configurar o log em arquivo: {e}")

def run_server():
    """Esta função apenas roda o servidor Uvicorn."""
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