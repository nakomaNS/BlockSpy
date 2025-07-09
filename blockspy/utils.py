import re
import socket
import aiohttp
import logging
import uuid
import hashlib
import asyncio
import os

# Regex do commands.py
IP_DOMAIN_REGEX = re.compile(r"^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,6}(?::\d+)?$|^(?:[0-9]{1,3}\.){3}[0-9]{1,3}(?::\d+)?$")

def limpar_formatacao_minecraft(texto: str) -> str:
    """Remove os códigos de formatação de cor do Minecraft do texto."""
    return re.sub(r'§[0-9a-fk-orA-FK-OR]', '', texto)

def is_valid_minecraft_nick(nick: str) -> bool:
    """Verifica se um nick de jogador é válido."""
    if not (3 <= len(nick) <= 16): return False
    if not re.match(r'^[a-zA-Z0-9_]+$', nick): return False
    return True

async def get_country_from_ip(ip_address: str, logger: logging.Logger) -> str:
    """
    Obtém o país e a bandeira a partir de um endereço IP/domínio.
    """
    ip_only = ip_address.split(':')[0]
    try:
        if not re.match(r"^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$", ip_only):
            loop = asyncio.get_running_loop()
            ip_only = await loop.run_in_executor(None, socket.gethostbyname, ip_only)
    except socket.gaierror:
        return "Domínio Inválido"

    url = f"http://ip-api.com/json/{ip_only}"
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(url) as response:
                if response.status == 200:
                    data = await response.json()
                    if data.get('status') == 'success':
                        country = data.get('country', 'Desconhecido')
                        country_code = data.get('countryCode', '')
                        if country_code:
                            flag_emoji = "".join(chr(ord(c) + 127397) for c in country_code.upper())
                            return f"{flag_emoji} {country}"
                        return country
                    else:
                        return "IP Privado/Inválido"
                else:
                    return "Não foi possível determinar"
    except Exception as e:
        logger.warning(f"Erro ao consultar API de geolocalização para {ip_only}: {e}")
        return "Falha na Consulta"

async def determinar_tipo_servidor(status, tipo_atual_db: str, ip: str, logger: logging.Logger) -> str:
    """
    Determina se o servidor é Original ou Pirata, retornando o tipo para o DB.
    """

    if tipo_atual_db in ("Original", "Pirata"):
        return tipo_atual_db

    try:

        if status.players.online == 0:
            return "Indeterminado"
        

        if not status.players.sample:
            return "Lista Oculta"

        player_sample = status.players.sample[0]
        
        uuid_offline = uuid.UUID(bytes=hashlib.md5(f"OfflinePlayer:{player_sample.name}".encode('utf-8')).digest(), version=3)

        if player_sample.id == str(uuid_offline):
            return "Pirata"
        else:
            return "Original"
            
    except Exception as e:
        logger.warning(f"Erro ao determinar tipo do servidor {ip}: {e}")
        return "Erro na Checagem"

def get_persistent_data_path(filename: str) -> str:
    """
    Cria e retorna o caminho para um arquivo de dados persistente
    na pasta do usuário. Garante que a pasta exista.
    """
    app_data_dir = os.path.join(os.path.expanduser('~'), 'BlockSpy')
    
    os.makedirs(app_data_dir, exist_ok=True)
    
    return os.path.join(app_data_dir, filename)