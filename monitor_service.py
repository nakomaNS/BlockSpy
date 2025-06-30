import asyncio
import aiosqlite
import logging
from datetime import datetime
from mcstatus import JavaServer
from typing import Optional, List
import os
import json
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler
from fastapi import WebSocket
from utils import determinar_tipo_servidor, get_country_from_ip
from async_mcrcon import MinecraftClient
from datetime import datetime, timezone

# --- EXCEÇÕES CUSTOMIZADAS PARA CLAREZA ---
class RconAuthenticationError(Exception):
    """Exceção para falha de autenticação RCON."""
    pass

class RconConnectionError(Exception):
    """Exceção para outras falhas de conexão RCON."""
    pass

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')

# Constantes para controle do monitoramento
INTERVALO_SEGUNDOS_ONLINE = 20
DELAY_BETWEEN_BATCHES = 5
BATCH_SIZE = 5

class LogFileHandler(FileSystemEventHandler):
    def __init__(self, file_path, callback):
        self.file_path = file_path
        self.callback = callback
        self.last_pos = 0
        if os.path.exists(self.file_path):
            try:
                with open(self.file_path, 'r', encoding='utf-8', errors='ignore') as f:
                    f.seek(0, 2)
                    self.last_pos = f.tell()
            except Exception as e:
                logging.warning(f"Não foi possível acessar o log em {file_path}: {e}")

    def on_modified(self, event):
        if event.src_path == self.file_path:
            try:
                with open(self.file_path, 'r', encoding='utf-8', errors='ignore') as f:
                    f.seek(self.last_pos)
                    new_lines = f.readlines()
                    if new_lines:
                        asyncio.create_task(self.callback(new_lines))
                        self.last_pos = f.tell()
            except Exception as e:
                logging.warning(f"Erro ao ler modificações do log {self.file_path}: {e}")

class MonitorService:
    def __init__(self, db_path: str):
        self.db_path = db_path
        self.db_connection: Optional[aiosqlite.Connection] = None
        self.logger = logging.getLogger(self.__class__.__name__)
        self.log_observers = {}

    async def connect_db(self):
        self.db_connection = await aiosqlite.connect(self.db_path)
        self.db_connection.row_factory = aiosqlite.Row
        self.logger.info(f"Conexão com o banco de dados '{self.db_path}' estabelecida.")
        await self._criar_tabelas()
        await self._atualizar_schema()
    
    async def get_server_events(self, ip_servidor: str, limit: int = 50) -> list:
        cursor = await self.db_connection.execute("SELECT id FROM servidores WHERE ip_servidor = ?", (ip_servidor,))
        server_row = await cursor.fetchone()
        if not server_row:
            return []
        
        query = "SELECT timestamp, tipo_evento, detalhes FROM eventos WHERE servidor_id = ? ORDER BY timestamp DESC LIMIT ?"
        cursor = await self.db_connection.execute(query, (server_row['id'], limit))
        return [dict(row) for row in await cursor.fetchall()]

    async def test_rcon_connection(self, host: str, port: int, password: str):
        self.logger.info(f"Iniciando teste de RCON para {host}:{port}")
        try:
            reader, writer = await asyncio.wait_for(
                asyncio.open_connection(host, port), timeout=5
            )
            writer.close()
            await writer.wait_closed()
        except (ConnectionRefusedError, asyncio.TimeoutError, OSError) as e:
            raise RconConnectionError(f"Erro: Porta RCON ({port}) inacessível ou bloqueada por firewall.")

        try:
            async with MinecraftClient(host=host, port=port, password=password) as client:
                await client.send("list")
        except Exception as e:
            error_text = str(e).lower()
            if "authentication failed" in error_text or "incorrect password" in error_text:
                raise RconAuthenticationError("Senha RCON incorreta.")
            else:
                raise RconConnectionError(f"Erro inesperado na conexão RCON: {e}")

    async def execute_rcon_command(self, ip_servidor: str, command: str) -> str:
        """Conecta-se via RCON, executa um comando e retorna a resposta."""
        self.logger.info(f"Executando comando RCON em {ip_servidor}: '{command}'")
        try:
            server_data = await self.get_server_data(ip_servidor)

            if not server_data or not server_data['rcon_port'] or not server_data['rcon_password']:
                return "ERRO: Dados de conexão RCON não configurados."

            async with MinecraftClient(
                host=server_data['ip_servidor'],
                port=int(server_data['rcon_port']),
                password=str(server_data['rcon_password'])
            ) as client:
                response_raw = await client.send(command)

                if isinstance(response_raw, bytes):
                    response_text = response_raw.decode("utf-8", errors="ignore")
                else:
                    response_text = str(response_raw)

                # Remove formatação de cores do Minecraft
                import re
                response_text = re.sub(r'§.', '', response_text)

                return response_text if response_text.strip() else "[Servidor não retornou resposta]"

        except Exception as e:
            self.logger.error(f"Falha ao executar comando RCON em {ip_servidor}: {e}", exc_info=True)
            return f"ERRO RCON: {type(e).__name__} - {e}"


    async def get_server_data(self, ip_servidor: str) -> dict:
        """ Busca todos os dados de um único servidor. """
        cursor = await self.db_connection.execute(
            "SELECT * FROM servidores WHERE ip_servidor = ?", (ip_servidor,)
    )
        row = await cursor.fetchone()
        return dict(row) if row else None
        
    async def _criar_tabelas(self):
        self.logger.info("Verificando e criando a estrutura final do banco de dados...")
        await self.db_connection.execute("""
            CREATE TABLE IF NOT EXISTS servidores (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                ip_servidor TEXT UNIQUE NOT NULL,
                nome_servidor TEXT,
                nome_customizado TEXT,
                status TEXT DEFAULT 'pending',
                versao TEXT,
                jogadores_online INTEGER DEFAULT 0,
                jogadores_maximos INTEGER DEFAULT 0,
                ping REAL DEFAULT 0,
                localizacao TEXT,
                tem_icone_customizado INTEGER DEFAULT 0,
                ultima_verificacao TEXT,
                tipo_servidor TEXT,
                pausado INTEGER DEFAULT 0,
                caminho_servidor TEXT DEFAULT NULL,
                rcon_port INTEGER,
                rcon_password TEXT
            );
        """)
        await self.db_connection.execute("""
            CREATE TABLE IF NOT EXISTS log_status (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                servidor_id INTEGER NOT NULL,
                timestamp TEXT NOT NULL,
                ping REAL,
                jogadores_online INTEGER,
                FOREIGN KEY(servidor_id) REFERENCES servidores(id) ON DELETE CASCADE
            );
        """)
        await self.db_connection.execute("""
            CREATE TABLE IF NOT EXISTS historico_jogadores (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                servidor_id INTEGER NOT NULL,
                nome_jogador TEXT NOT NULL,
                uuid TEXT,
                status_online INTEGER DEFAULT 0,
                ultima_vez_visto TEXT,
                FOREIGN KEY(servidor_id) REFERENCES servidores(id) ON DELETE CASCADE,
                UNIQUE(servidor_id, nome_jogador)
            );
        """)
        await self.db_connection.execute("""
            CREATE TABLE IF NOT EXISTS eventos (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                servidor_id INTEGER NOT NULL,
                timestamp TEXT NOT NULL,
                tipo_evento TEXT NOT NULL,
                detalhes TEXT,
                FOREIGN KEY(servidor_id) REFERENCES servidores(id) ON DELETE CASCADE
            );
        """)
        await self.db_connection.commit()

    async def _atualizar_schema(self):
        """Verifica e aplica atualizações necessárias no schema do banco de dados."""
        try:
            self.logger.info("Verificando schema do banco de dados...")
            cursor = await self.db_connection.execute("PRAGMA table_info(servidores);")
            columns = [row[1] for row in await cursor.fetchall()]

            if 'nome_customizado' not in columns:
                self.logger.info("Adicionando coluna 'nome_customizado'...")
                await self.db_connection.execute('ALTER TABLE servidores ADD COLUMN nome_customizado TEXT;')
                self.logger.info("Coluna 'nome_customizado' adicionada.")

            if 'caminho_servidor' not in columns:
                self.logger.info("Adicionando coluna 'caminho_servidor' para o RCON/Log...")
                await self.db_connection.execute('ALTER TABLE servidores ADD COLUMN caminho_servidor TEXT DEFAULT NULL;')
                self.logger.info("Coluna 'caminho_servidor' adicionada com sucesso!")

            await self.db_connection.commit()
            self.logger.info("Schema verificado e atualizado!")

        except Exception as e:
            self.logger.error(f"Ocorreu um erro grave ao atualizar o schema do banco de dados: {e}")

            # CALENDARIO DO HEATMAP #
    async def get_calendar_heatmap_data(self, ip_servidor: str) -> list:
        self.logger.info(f"Gerando dados de calendário para {ip_servidor}")
        cursor = await self.db_connection.execute("SELECT id FROM servidores WHERE ip_servidor = ?", (ip_servidor,))
        server_info = await cursor.fetchone()
        if not server_info: return []

        query = """
            SELECT
                strftime('%s', date(timestamp)) as timestamp,
                CAST(AVG(jogadores_online) AS INTEGER) as value
            FROM log_status
            WHERE servidor_id = ? AND timestamp >= datetime('now', '-120 days')
            GROUP BY date(timestamp);
        """
        cursor = await self.db_connection.execute(query, (server_info['id'],))
        # O formato final é { timestamp_unix: valor }, que a nova biblioteca entende
        return [dict(row) for row in await cursor.fetchall()]

    async def _update_server_data(self, servidor_row):
        ip = servidor_row['ip_servidor']
        server_id = servidor_row['id']
        timestamp = datetime.now(timezone.utc).isoformat()
        
        # Pegamos os dados antigos para comparação
        status_anterior = servidor_row['status']
        versao_anterior = servidor_row['versao']

        try:
            server = await JavaServer.async_lookup(ip, timeout=10)
            status = await server.async_status()
            
            # Se mudou de offline para online, registramos o evento
            if status_anterior != 'online':
                await self.db_connection.execute(
                    "INSERT INTO eventos (servidor_id, timestamp, tipo_evento, detalhes) VALUES (?, ?, ?, ?)",
                    (server_id, timestamp, 'SERVIDOR_ONLINE', f"Servidor ficou online com {status.players.online} jogadores.")
                )

            # --- NOVO: LÓGICA PARA NOVOS EVENTOS ---
            # 1. Evento de Mudança de Versão
            if versao_anterior and status.version.name != versao_anterior:
                await self.db_connection.execute(
                    "INSERT INTO eventos (servidor_id, timestamp, tipo_evento, detalhes) VALUES (?, ?, ?, ?)",
                    (server_id, timestamp, 'VERSAO_ALTERADA', f"Versão alterada de '{versao_anterior}' para '{status.version.name}'.")
                )
            
            # 2. Evento de Novo Pico de Jogadores (requer buscar o pico atual)
            stats_cursor = await self.db_connection.execute(
                "SELECT MAX(jogadores_online) as peak_24h FROM log_status WHERE servidor_id = ? AND timestamp >= datetime('now', '-24 hours')",
                (server_id,)
            )
            stats_24h = await stats_cursor.fetchone()
            pico_anterior_24h = stats_24h['peak_24h'] if stats_24h and stats_24h['peak_24h'] is not None else 0

            if status.players.online > pico_anterior_24h:
                await self.db_connection.execute(
                    "INSERT INTO eventos (servidor_id, timestamp, tipo_evento, detalhes) VALUES (?, ?, ?, ?)",
                    (server_id, timestamp, 'NOVO_PICO_JOGADORES', f"🏆 Novo recorde de jogadores em 24h: {status.players.online} jogadores.")
                )
            # --- FIM DA NOVA LÓGICA ---


            await self._update_player_history(server_id, status.players.sample)
            
            tem_icone = 1 if status.icon else 0
            ping = round(status.latency)
            jogadores_online = status.players.online
            nome_servidor = str(status.description)
            localizacao = servidor_row['localizacao']
            if not localizacao or "Inválido" in localizacao or "Falha" in localizacao:
                localizacao = await get_country_from_ip(ip, self.logger)
            tipo_servidor = await determinar_tipo_servidor(status, servidor_row['tipo_servidor'], ip, self.logger)
            
            await self.db_connection.execute(
                """UPDATE servidores SET status=?, nome_servidor=?, versao=?, jogadores_online=?, 
                jogadores_maximos=?, ping=?, tem_icone_customizado=?, localizacao=?, ultima_verificacao=?, 
                tipo_servidor=? WHERE id=?""",
                ('online', nome_servidor, status.version.name, 
                jogadores_online, status.players.max, ping, tem_icone, localizacao, timestamp, 
                tipo_servidor, server_id)
            )
            await self.db_connection.execute(
                "INSERT INTO log_status (servidor_id, timestamp, ping, jogadores_online) VALUES (?, ?, ?, ?)",
                (server_id, timestamp, ping, jogadores_online)
            )

        except Exception as e:
            if status_anterior == 'online':
                await self.db_connection.execute(
                    "INSERT INTO eventos (servidor_id, timestamp, tipo_evento, detalhes) VALUES (?, ?, ?, ?)",
                    (server_id, timestamp, 'SERVIDOR_OFFLINE', "Servidor ficou offline.")
                )
            await self.db_connection.execute(
                "UPDATE servidores SET status='offline', ultima_verificacao=? WHERE id=?",
                (timestamp, server_id)
            )
            self.logger.error(f"Erro ao monitorar {ip}: {e}")
        
        await self.db_connection.commit()


    async def get_server_stats(self, ip_servidor: str, hours: int = 24) -> dict:
        """Calcula e retorna estatísticas vitais para um servidor nas últimas X horas."""
        stats = {
            "uptime_percent": 0,
            "peak_players": 0,
            "average_players": 0,
        }

        server_cursor = await self.db_connection.execute(
            "SELECT id FROM servidores WHERE ip_servidor = ?", (ip_servidor,)
        )
        server_info = await server_cursor.fetchone()
        if not server_info:
            return stats
        server_id = server_info['id']

        log_cursor = await self.db_connection.execute(
            "SELECT jogadores_online FROM log_status WHERE servidor_id = ? AND timestamp >= datetime('now', ?)",
            (server_id, f'-{hours} hours')
        )
        logs = await log_cursor.fetchall()

        if not logs:
            return stats

        online_players = [row['jogadores_online'] for row in logs if row['jogadores_online'] is not None]
        if not online_players:
            return stats

        stats["peak_players"] = max(online_players)
        stats["average_players"] = round(sum(online_players) / len(online_players))

        total_possible_checks = (hours * 3600) / INTERVALO_SEGUNDOS_ONLINE
        online_checks_count = len(logs)
        stats["uptime_percent"] = round((online_checks_count / total_possible_checks) * 100, 1)
        if stats["uptime_percent"] > 100:
            stats["uptime_percent"] = 100.0

        return stats

    async def _update_player_history(self, server_id: int, players_from_status: Optional[list]):
        if not self.db_connection: return
        timestamp = datetime.now(timezone.utc).isoformat()
        current_players_on_server = {p.name for p in players_from_status} if players_from_status else set()
        
        async with self.db_connection.execute("SELECT nome_jogador FROM historico_jogadores WHERE servidor_id = ? AND status_online = 1", (server_id,)) as cursor:
            db_online_players = {row['nome_jogador'] for row in await cursor.fetchall()}
        
        logged_off = db_online_players - current_players_on_server
        logged_on = current_players_on_server - db_online_players
        
        if not logged_off and not logged_on: return
        
        try:
            await self.db_connection.execute('BEGIN')
            if logged_off:
                placeholders = ','.join('?' for _ in logged_off)
                await self.db_connection.execute(f"UPDATE historico_jogadores SET status_online = 0, ultima_vez_visto = ? WHERE servidor_id = ? AND nome_jogador IN ({placeholders})", (timestamp, server_id, *logged_off))
                # --- LÓGICA DE EVENTO DE JOGADOR ---
                for player_name in logged_off:
                    await self.db_connection.execute(
                        "INSERT INTO eventos (servidor_id, timestamp, tipo_evento, detalhes) VALUES (?, ?, ?, ?)",
                        (server_id, timestamp, 'JOGADOR_SAIU', f"Jogador '{player_name}' saiu.")
                    )

            for player_name in logged_on:
                player_uuid = next((p.id for p in players_from_status if p.name == player_name), None)
                await self.db_connection.execute("""
                    INSERT INTO historico_jogadores (servidor_id, nome_jogador, uuid, status_online, ultima_vez_visto)
                    VALUES (?, ?, ?, 1, ?)
                    ON CONFLICT(servidor_id, nome_jogador) DO UPDATE SET
                    status_online = 1, ultima_vez_visto = excluded.ultima_vez_visto, uuid = excluded.uuid
                """, (server_id, player_name, player_uuid, timestamp))
                # --- LÓGICA DE EVENTO DE JOGADOR ---
                await self.db_connection.execute(
                    "INSERT INTO eventos (servidor_id, timestamp, tipo_evento, detalhes) VALUES (?, ?, ?, ?)",
                    (server_id, timestamp, 'JOGADOR_ENTROU', f"Jogador '{player_name}' entrou.")
                )

            await self.db_connection.commit()
        except Exception as e:
            await self.db_connection.execute('ROLLBACK')
            self.logger.error(f"Erro ao atualizar histórico de jogadores para o servidor {server_id}: {e}")


    async def _monitor_loop(self):
        while True:
            self.logger.info("--- INICIANDO NOVO CICLO DE MONITORAMENTO ---")
            try:
                cursor = await self.db_connection.execute("SELECT * FROM servidores WHERE pausado = 0")
                servidores_ativos = await cursor.fetchall()
                if servidores_ativos:
                    tasks = [self._update_server_data(s) for s in servidores_ativos]
                    for i in range(0, len(tasks), BATCH_SIZE):
                        batch_tasks = tasks[i:i + BATCH_SIZE]
                        self.logger.info(f"Processando lote {i//BATCH_SIZE + 1}...")
                        await asyncio.gather(*batch_tasks)
                        if i + BATCH_SIZE < len(tasks):
                            await asyncio.sleep(DELAY_BETWEEN_BATCHES)
            except Exception as e:
                self.logger.error(f"Erro grave no loop de monitoramento: {e}", exc_info=True)
            
            self.logger.info(f"--- CICLO COMPLETO. Próxima verificação em {INTERVALO_SEGUNDOS_ONLINE} segundos. ---")
            await asyncio.sleep(INTERVALO_SEGUNDOS_ONLINE)
            
    async def start_monitoring(self):
        self.logger.info("Iniciando loop de monitoramento inteligente...")
        asyncio.create_task(self._monitor_loop())

    async def add_servidor(self, ip_servidor: str) -> dict:
        cursor = await self.db_connection.execute("SELECT id FROM servidores WHERE ip_servidor = ?", (ip_servidor,))
        if await cursor.fetchone():
            raise ValueError(f"O servidor '{ip_servidor}' já está na lista.")
        try:
            await self.db_connection.execute(
                "INSERT INTO servidores (ip_servidor, nome_servidor, pausado, status, caminho_servidor) VALUES (?, ?, ?, ?, ?)",
                (ip_servidor, ip_servidor, 0, 'pending', None)
            )
            await self.db_connection.commit()
            return {"message": f"Servidor '{ip_servidor}' adicionado à fila de monitoramento."}
        except Exception as e:
            raise ValueError(f"Erro de banco de dados ao adicionar '{ip_servidor}'.")

    async def get_all_servers_status(self) -> list:
        cursor = await self.db_connection.execute("SELECT * FROM servidores ORDER BY jogadores_online DESC")
        rows = await cursor.fetchall()
        return [dict(row) for row in rows]
    
    async def delete_server(self, ip_servidor: str) -> bool:
        cursor = await self.db_connection.execute("DELETE FROM servidores WHERE ip_servidor = ?", (ip_servidor,))
        await self.db_connection.commit()
        return cursor.rowcount > 0

    async def toggle_server_pause(self, ip_servidor: str) -> bool:
        cursor = await self.db_connection.execute("UPDATE servidores SET pausado = NOT pausado WHERE ip_servidor = ?", (ip_servidor,))
        await self.db_connection.commit()
        return cursor.rowcount > 0
        
    async def update_server_details(self, original_ip: str, request_data) -> dict:
        self.logger.info("--- INICIANDO PROCESSO DE UPDATE (INVESTIGAÇÃO) ---")
        try:
            cursor = await self.db_connection.execute("SELECT id FROM servidores WHERE ip_servidor = ?", (original_ip,))
            server_id_row = await cursor.fetchone()
            if not server_id_row:
                raise ValueError(f"Servidor original '{original_ip}' não encontrado.")
            server_id = server_id_row['id']
            self.logger.info(f"[ETAPA 1] Servidor ID: {server_id} encontrado.")

            # Pega todos os dados que o formulário enviou
            update_dict = request_data.model_dump() # Usamos dump() sem argumentos para ver TUDO
            self.logger.info(f"[ETAPA 2] Dados recebidos do formulário (bruto): {update_dict}")

            # Dicionário para "traduzir" nomes da API para nomes do Banco de Dados
            api_to_db_map = {
                'new_ip': 'ip_servidor',
                'custom_name': 'nome_customizado'
            }
            db_update_dict = {}
            for api_key, value in update_dict.items():
                db_column_name = api_to_db_map.get(api_key, api_key)
                db_update_dict[db_column_name] = value
            self.logger.info(f"[ETAPA 3] Dicionário traduzido para nomes do DB: {db_update_dict}")

            # Remove campos com valores "vazios" para não sujar o banco
            db_update_dict_final = {k: v for k, v in db_update_dict.items() if v is not None and v != ''}
            self.logger.info(f"[ETAPA 4] Dicionário final após limpar vazios/nulos: {db_update_dict_final}")

            if not db_update_dict_final:
                self.logger.warning("[ETAPA 5] Nenhuma alteração detectada. Encerrando.")
                return {"message": "Nenhuma alteração para salvar."}

            # Constrói a query final e os parâmetros
            fields_to_update = [f"{key} = ?" for key in db_update_dict_final.keys()]
            params = list(db_update_dict_final.values())
            query = f"UPDATE servidores SET {', '.join(fields_to_update)} WHERE id = ?"
            params.append(server_id)
            self.logger.info(f"[ETAPA 5] Query SQL montada: {query}")
            self.logger.info(f"[ETAPA 6] Parâmetros para a query: {tuple(params)}")

            await self.db_connection.execute(query, tuple(params))
            await self.db_connection.commit()
            
            self.logger.info(f"[ETAPA 7] Servidor ID {server_id} atualizado com sucesso!")
            return {"message": "Servidor atualizado com sucesso."}

        except Exception as e:
            self.logger.error(f"ERRO GRAVE DURANTE O UPDATE: {e}", exc_info=True)
            raise e

    async def xi(self, ip_servidor: str, command: str) -> str:
        """ Conecta-se via RCON, executa um comando e retorna a resposta usando a biblioteca async-mcrcon. """

        self.logger.info(f"Executando comando RCON em {ip_servidor}: '{command}'")
        try:
            server_data = await self.get_server_data(ip_servidor)

            if not server_data or not server_data['rcon_port'] or not server_data['rcon_password']:
                return "ERRO: Dados de conexão RCON (porta e senha) não configurados para este servidor."
            
            async with MinecraftClient(
                host=server_data['ip_servidor'], 
                port=int(server_data['rcon_port']), 
                password=str(server_data['rcon_password'])
            ) as client:
                response_tuple = await client.send(command)
                response = response_tuple[0] if response_tuple else ""
                return response if response else "[Servidor não retornou resposta]"
        
        except Exception as e:
            self.logger.error(f"Falha ao executar comando RCON em {ip_servidor}: {e}", exc_info=True)
            return f"ERRO RCON: {type(e).__name__} - {e}"
    
    async def stream_log_file(self, ip_servidor: str, websocket: WebSocket, manager):
        observer = None
        try:
            cursor = await self.db_connection.execute("SELECT caminho_servidor FROM servidores WHERE ip_servidor = ?", (ip_servidor,))
            row = await cursor.fetchone()
            if not row or not row['caminho_servidor']:
                await manager.send_personal_message('{"type": "status", "data": "ERRO: Caminho do servidor não configurado."}', websocket)
                return
            log_path = os.path.join(row['caminho_servidor'], 'logs', 'latest.log')
            if not os.path.exists(log_path):
                await manager.send_personal_message(f'{{"type": "status", "data": "ERRO: latest.log não encontrado."}}', websocket)
                return
            async def send_log_lines(lines: List[str]):
                for line in lines:
                    payload = {
                        "type": "log",
                        "data": line.strip()
                    }
                    log_message = json.dumps(payload)
                    await manager.send_personal_message(log_message, websocket)
            try:
                with open(log_path, 'r', encoding='utf-8', errors='ignore') as f:
                    last_lines = f.readlines()[-15:]
                    if last_lines: await send_log_lines(last_lines)
            except Exception as e:
                self.logger.warning(f"Não foi possível ler o histórico do log: {e}")
            event_handler = LogFileHandler(log_path, send_log_lines)
            observer = Observer()
            observer.schedule(event_handler, os.path.dirname(log_path), recursive=False)
            observer.start()
            self.log_observers[ip_servidor] = observer
            self.logger.info(f"Iniciado monitoramento de log para: {log_path}")

            await manager.send_personal_message('{"type": "status", "data": "--- Conectado ao console ao vivo ---"}', websocket)
            while websocket.client_state.name == 'CONNECTED':
                await asyncio.sleep(1)
        except asyncio.CancelledError:
            self.logger.info(f"Streaming de log para {ip_servidor} cancelado.")
        finally:
            if observer:
                observer.stop()
                observer.join()
            self.log_observers.pop(ip_servidor, None)
            self.logger.info(f"Encerrado monitoramento de log para: {ip_servidor}")
        
    async def get_server_history(self, ip_servidor: str, hours: int = 24) -> list:
        server_cursor = await self.db_connection.execute(
            "SELECT id, jogadores_maximos FROM servidores WHERE ip_servidor = ?", (ip_servidor,)
        )
        server_info = await server_cursor.fetchone()
        if not server_info: return []
        
        server_id, jogadores_maximos = server_info['id'], server_info['jogadores_maximos']
        
        log_query = "SELECT timestamp, jogadores_online, ping FROM log_status WHERE servidor_id = ? AND timestamp >= datetime('now', ?) ORDER BY timestamp ASC"
        log_cursor = await self.db_connection.execute(log_query, (server_id, f'-{hours} hours'))
        logs = await log_cursor.fetchall()
        if not logs: return []
        
        processed_history = []
        previous_players = logs[0]['jogadores_online']
        
        for i, row in enumerate(logs):
            log_data = dict(row)
            if jogadores_maximos and jogadores_maximos > 0 and row['jogadores_online'] is not None:
                log_data['lotacao_percentual'] = round((row['jogadores_online'] / jogadores_maximos) * 100, 2)
            else:
                log_data['lotacao_percentual'] = 0
            
            if row['jogadores_online'] is not None and previous_players is not None:
                log_data['variacao_jogadores'] = row['jogadores_online'] - previous_players
            else:
                log_data['variacao_jogadores'] = 0
            
            previous_players = row['jogadores_online']
            processed_history.append(log_data)
        
        return processed_history

    async def get_player_history(self, ip_servidor: str, limit: int = 50) -> list:
        cursor = await self.db_connection.execute("SELECT id FROM servidores WHERE ip_servidor = ?", (ip_servidor,))
        server_row = await cursor.fetchone()
        if not server_row: return {"online": [], "offline": []}
        
        server_id = server_row['id']
        
        online_cursor = await self.db_connection.execute("SELECT nome_jogador FROM historico_jogadores WHERE servidor_id = ? AND status_online = 1 ORDER BY nome_jogador ASC", (server_id,))
        online_players = [row['nome_jogador'] for row in await online_cursor.fetchall()]
        
        offline_cursor = await self.db_connection.execute("SELECT nome_jogador, ultima_vez_visto FROM historico_jogadores WHERE servidor_id = ? AND status_online = 0 ORDER BY ultima_vez_visto DESC LIMIT ?", (server_id, limit))
        offline_players = [dict(row) for row in await offline_cursor.fetchall()]
        
        return {"online": online_players, "offline": offline_players}

    async def get_activity_heatmap(self, ip_servidor: str) -> list:
        """
        Busca e processa dados de log para criar um mapa de calor de atividade.
        Os dados são agrupados por dia da semana e hora do dia.
        """
        self.logger.info(f"Gerando dados de mapa de calor para {ip_servidor}")

        cursor = await self.db_connection.execute(
            "SELECT id FROM servidores WHERE ip_servidor = ?", (ip_servidor,)
        )
        server_info = await cursor.fetchone()
        if not server_info:
            return []
        server_id = server_info['id']

        query = """
            SELECT
                CAST(strftime('%w', timestamp) AS INTEGER) as day_of_week,
                CAST(strftime('%H', timestamp) AS INTEGER) as hour_of_day,
                AVG(jogadores_online) as avg_players
            FROM log_status
            WHERE servidor_id = ? AND timestamp >= datetime('now', '-30 days')
            GROUP BY day_of_week, hour_of_day;
        """
        cursor = await self.db_connection.execute(query, (server_id,))
        rows = await cursor.fetchall()

        heatmap_data = [
            {
                "x": row['hour_of_day'],
                "y": 6 - row['day_of_week'],
                "v": round(row['avg_players'], 1) if row['avg_players'] is not None else 0
            }
            for row in rows
        ]
        return heatmap_data