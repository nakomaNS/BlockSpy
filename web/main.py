import asyncio
import httpx
from fastapi import FastAPI, Request, status, HTTPException
from fastapi.responses import HTMLResponse, JSONResponse, Response
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
import logging
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from fastapi import WebSocket, WebSocketDisconnect
from typing import List, Optional
import os
import sys
import json
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from monitor_service import MonitorService, RconAuthenticationError, RconConnectionError
logging.basicConfig(level=logging.INFO, format='%(asctime)s:%(levelname)s:%(name)s: %(message)s')

service = MonitorService(db_path="database.db")

@asynccontextmanager
async def lifespan(app: FastAPI):
    logging.info("Aplicação web iniciando...")
    await service.connect_db()
    asyncio.create_task(service.start_monitoring())
    yield
    logging.info("Aplicação web encerrada.")
    for observer in service.log_observers.values():
        observer.stop()
        observer.join()

app = FastAPI(lifespan=lifespan)

# --- MIDDLEWARE (CORS) ---
origins = ["*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- ARQUIVOS ESTÁTICOS E TEMPLATES ---
app.mount("/static", StaticFiles(directory="web/static"), name="static")
templates = Jinja2Templates(directory="web/templates")

# --- MODELOS DE DADOS (PYDANTIC) ---
class ServerAddRequest(BaseModel):
    ip: str

class RconTestRequest(BaseModel):
    ip: str
    rcon_port: int
    rcon_password: str

class ServerUpdateRequest(BaseModel):
    new_ip: Optional[str] = None
    custom_name: Optional[str] = None
    caminho_servidor: Optional[str] = None
    rcon_port: Optional[int] = None
    rcon_password: Optional[str] = None

# --- GERENCIADOR DE WEBSOCKET ---
class ConnectionManager:
    def __init__(self):
        self.active_connections: dict = {}

    async def connect(self, websocket: WebSocket, client_id: str):
        await websocket.accept()
        self.active_connections[client_id] = websocket

    def disconnect(self, client_id: str):
        if client_id in self.active_connections:
            del self.active_connections[client_id]

    async def send_personal_message(self, message: str, websocket: WebSocket):
        await websocket.send_text(message)

manager = ConnectionManager()


# --- ENDPOINTS HTTP ---

@app.post("/api/rcon/test", status_code=status.HTTP_200_OK)
async def test_rcon_endpoint(request_data: RconTestRequest):
    """ Endpoint para validar uma conexão RCON antes de salvar. """
    try:
        await service.test_rcon_connection(
            host=request_data.ip.strip(),
            port=request_data.rcon_port,
            password=request_data.rcon_password
        )
        # Se a função acima não levantar erro, a conexão foi um sucesso.
        return JSONResponse(content={"status": "ok", "message": "Conexão RCON validada com sucesso!"})

    except RconAuthenticationError as e:
        # Se a senha estiver errada, retorna um erro 401 (Não Autorizado)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(e))
    
    except RconConnectionError as e:
        # Se a porta estiver fechada ou outro erro de conexão, retorna 400
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    
    except Exception as e:
        # Pega qualquer outro erro inesperado
        logging.error(f"Erro inesperado no teste RCON: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Ocorreu um erro interno no servidor durante o teste.")

@app.get("/", response_class=HTMLResponse)
async def read_root(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})

@app.get("/api/servers")
async def get_servers_status():
    servers = await service.get_all_servers_status()
    return JSONResponse(content=servers)

@app.post("/api/servers", status_code=status.HTTP_201_CREATED)
async def add_new_server(server_request: ServerAddRequest):
    try:
        result = await service.add_servidor(server_request.ip.strip())
        return result
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

@app.patch("/api/servers/{server_ip}", status_code=status.HTTP_200_OK)
async def update_server_endpoint(server_ip: str, request_data: ServerUpdateRequest):
    try:
        result = await service.update_server_details(server_ip.strip(), request_data)
        return JSONResponse(content=result)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logging.error(f"Erro inesperado ao editar servidor {server_ip}: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Ocorreu um erro interno no servidor.")

@app.delete("/api/servers/{server_ip}")
async def delete_server_endpoint(server_ip: str):
    success = await service.delete_server(server_ip.strip())
    if not success:
        raise HTTPException(status_code=404, detail="Servidor não encontrado")
    return {"message": f"Servidor {server_ip} removido com sucesso."}

@app.post("/api/servers/{server_ip}/toggle_pause", status_code=status.HTTP_200_OK)
async def toggle_server_pause_endpoint(server_ip: str):
    success = await service.toggle_server_pause(server_ip.strip())
    if not success:
        raise HTTPException(status_code=404, detail="Servidor não encontrado")
    return {"message": f"Status de monitoramento para {server_ip} alterado."}

@app.get("/api/servers/{server_ip}/history")
async def get_server_history_endpoint(server_ip: str, hours: int = 24):
    """
    Busca o histórico de um servidor.
    Aceita um parâmetro de query 'hours' para definir o período.
    """
    # Passamos o parâmetro 'hours' para a função do serviço
    history_data = await service.get_server_history(server_ip.strip(), hours=hours)
    return JSONResponse(content=history_data)

@app.get("/api/servers/{server_ip}/players")
async def get_player_list_endpoint(server_ip: str):
    player_history = await service.get_player_history(server_ip.strip())
    return JSONResponse(content=player_history)

@app.get("/api/icon/{server_ip:path}")
async def get_server_icon_proxy(server_ip: str):
    url = f"https://api.mcsrvstat.us/icon/{server_ip}"
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(url, timeout=10.0, follow_redirects=True)
            response.raise_for_status()
            content_type = response.headers.get('content-type', 'image/png')
            return Response(content=response.content, media_type=content_type)
        except (httpx.RequestError, httpx.HTTPStatusError) as e:
            raise HTTPException(status_code=404, detail=f"Ícone não encontrado ou API externa falhou: {e}")
            
@app.get("/api/servers/{server_ip}/stats")
async def get_server_stats_endpoint(server_ip: str):
    stats = await service.get_server_stats(server_ip.strip())
    return JSONResponse(content=stats)

@app.get("/api/servers/{server_ip}/heatmap")
async def get_server_heatmap_endpoint(server_ip: str):
    heatmap_data = await service.get_activity_heatmap(server_ip.strip())
    return JSONResponse(content=heatmap_data)


# --- ENDPOINT WEBSOCKET ---

@app.websocket("/ws/console/{server_ip}")
async def console_websocket_endpoint(websocket: WebSocket, server_ip: str):
    client_id = f"{server_ip}:{websocket.client.port}"
    await manager.connect(websocket, client_id)
    
    log_stream_task = None
    try:
        server_data = await service.get_server_data(ip_servidor=server_ip)
        
        if server_data and server_data.get('caminho_servidor'):
            log_stream_task = asyncio.create_task(service.stream_log_file(server_ip, websocket, manager))
        else:
            status_msg = json.dumps({"type": "status", "data": "Conectado em modo RCON. Log ao vivo indisponível."})
            await manager.send_personal_message(status_msg, websocket)

        while True:
            command = await websocket.receive_text()
            
            # --- A LÓGICA DE BLINDAGEM ESTÁ AQUI ---
            try:
                sent_command_msg = json.dumps({"type": "rcon_sent", "data": command})
                await manager.send_personal_message(sent_command_msg, websocket)
                
                response = await service.execute_rcon_command(server_ip, command)
                
                rcon_response_msg = json.dumps({"type": "rcon_response", "data": response})
                await manager.send_personal_message(rcon_response_msg, websocket)
            
            except Exception as e:
                # Se qualquer coisa der errado ao executar o comando,
                # avisa o usuário mas NÃO derruba a conexão.
                logging.error(f"Erro no websocket ao processar comando RCON: {e}", exc_info=True)
                error_msg = json.dumps({"type": "rcon_response", "data": f"ERRO GERAL: {e}"})
                await manager.send_personal_message(error_msg, websocket)

    except WebSocketDisconnect:
        if log_stream_task:
            log_stream_task.cancel()
    finally:
        manager.disconnect(client_id)
        print(f"Cliente {client_id} desconectado do console.")
        
@app.get("/api/servers/{server_ip}/calendar_heatmap")
async def get_calendar_heatmap_endpoint(server_ip: str):
    data = await service.get_calendar_heatmap_data(server_ip.strip())
    return JSONResponse(content=data)

@app.get("/api/servers/{server_ip}/events")
async def get_server_events_endpoint(server_ip: str):
    events = await service.get_server_events(server_ip.strip())
    return JSONResponse(content=events)