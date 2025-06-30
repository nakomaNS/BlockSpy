import sqlite3
import sys

# Pega o IP do servidor do argumento da linha de comando
# Ex: python add_server.py mc.hypixel.net
if len(sys.argv) < 2:
    print("Erro: Forneça o IP do servidor como argumento.")
    print("Exemplo: python add_server.py mc.hypixel.net")
    sys.exit(1)

server_ip = sys.argv[1].strip()
db_path = 'database.db'

try:
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # Usa a coluna 'pausado' e o status 'pending'
    # INSERT OR IGNORE não falha se o IP já existir (por causa do UNIQUE)
    cursor.execute(
        "INSERT OR IGNORE INTO servidores (ip_servidor, nome_servidor, pausado, status) VALUES (?, ?, ?, ?)", 
        (server_ip, server_ip, 0, 'pending') # Inicia ativo (pausado=0) e pendente
    )
    
    if cursor.rowcount > 0:
        print(f"✅ Sucesso! Servidor '{server_ip}' adicionado à fila de monitoramento.")
    else:
        print(f"ℹ️ Aviso: Servidor '{server_ip}' já estava na lista.")

    conn.commit()
    conn.close()

except Exception as e:
    print(f"❌ Ocorreu um erro: {e}")