# cogs/monitoring.py
import discord
from discord.ext import commands, tasks
from mcstatus import JavaServer
from datetime import datetime, timezone, timedelta
import re
import uuid
import hashlib
import aiohttp
import socket
import logging
import asyncio

import config

def limpar_formatacao_minecraft(texto):
    return re.sub(r'§[0-9a-fk-orA-FK-OR]', '', texto)

def is_valid_minecraft_nick(nick):
    if not (3 <= len(nick) <= 16): return False
    if not re.match(r'^[a-zA-Z0-9_]+$', nick): return False
    return True

async def get_country_from_ip(ip_address: str, logger: logging.Logger):
    ip_only = ip_address.split(':')[0]
    try:
        if not re.match(r"^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$", ip_only):
            ip_only = socket.gethostbyname(ip_only)
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
                    else: return "IP Privado/Inválido"
                else: return "Não foi possível determinar"
    except Exception as e:
        logger.warning(f"Erro ao consultar API de geolocalização para {ip_only}: {e}")
        return "Falha na Consulta"


class MonitoringCog(commands.Cog):
    def __init__(self, bot):
        self.bot = bot
        self.logger = logging.getLogger(f"cogs.{self.__class__.__name__}")
        self.offline_counters = {}
        self.monitor_loop.change_interval(seconds=config.INTERVALO_SEGUNDOS_ONLINE)
        self.reverificacao_loop.change_interval(seconds=config.INTERVALO_SEGUNDOS_REVERIFICACAO)
        self.monitor_loop.start()
        self.reverificacao_loop.start()
        self.logger.info("Cog de Monitoramento carregado e loops iniciados.")

    def cog_unload(self):
        self.monitor_loop.cancel()
        self.reverificacao_loop.cancel()
        self.logger.info("Cog de Monitoramento descarregado e loops cancelados.")

    def _truncate_text(self, text: str, max_length: int = 1024) -> str:
        if len(text) > max_length:
            return text[:max_length - 3] + "..."
        return text

    @tasks.loop()
    async def monitor_loop(self):
        self.logger.info("Iniciando ciclo de monitoramento de servidores ativos...")
        cursor = await self.bot.db_connection.execute("SELECT id, ip_servidor, tipo FROM servidores WHERE ativo = 1")
        servidores = await cursor.fetchall()

        if not servidores:
            self.logger.info("Nenhum servidor ativo para verificar neste ciclo.")
            return

        for servidor in servidores:
            try:
                servidor_id, ip, tipo_atual_db = servidor['id'], servidor['ip_servidor'], servidor['tipo']
                self.logger.debug(f"Verificando [{ip}] (Tipo atual no DB: {tipo_atual_db})...")
                
                server = await self.bot.loop.run_in_executor(None, JavaServer.lookup, ip)
                status = await self.bot.loop.run_in_executor(None, server.status)
                
                self.offline_counters[ip] = 0
                
                nome_servidor = limpar_formatacao_minecraft(status.description)
                versao = status.version.name
                ping = round(status.latency)
                jogadores_online, jogadores_max = status.players.online, status.players.max
                localizacao_texto = await get_country_from_ip(ip, self.logger)
                
                # --- INÍCIO DA LÓGICA DE ESTADO IMUTÁVEL ---
                
                tipo_final_para_db = tipo_atual_db
                tipo_final_para_embed = tipo_atual_db # Por padrão, usamos o que já está salvo

                # Só tentamos descobrir o tipo se ele ainda não for definitivo.
                if tipo_atual_db not in ("Original", "Pirata"):
                    if status.players.online > 0 and not status.players.sample:
                        tipo_final_para_db = "Lista Oculta"
                        tipo_final_para_embed = "Indeterminado (Lista Oculta)"
                    elif status.players.sample:
                        p = status.players.sample[0]
                        try:
                            uuid_off = uuid.UUID(bytes=hashlib.md5(f"OfflinePlayer:{p.name}".encode('utf-8')).digest(), version=3)
                            if p.id == str(uuid_off):
                                tipo_final_para_db = "Pirata"
                                tipo_final_para_embed = "Pirata 🏴‍☠️"
                            else:
                                tipo_final_para_db = "Original"
                                tipo_final_para_embed = "Original 🛡️"
                        except Exception as e:
                            self.logger.warning(f"Erro ao verificar UUID para '{p.name}' em {ip}: {e}")
                            tipo_final_para_embed = "Erro na Checagem ⚠️"

                # Se o tipo já salvo for definitivo, apenas formata para o embed
                elif tipo_atual_db == "Original":
                    tipo_final_para_embed = "Original 🛡️"
                elif tipo_atual_db == "Pirata":
                    tipo_final_para_embed = "Pirata 🏴‍☠️"
                
                # --- FIM DA LÓGICA DE ESTADO IMUTÁVEL ---

                await self.bot.db_connection.execute(
                    "UPDATE servidores SET nome_servidor = ?, ultima_verificacao = ?, jogadores_maximos = ?, tipo = ? WHERE id = ?",
                    (nome_servidor, datetime.utcnow().isoformat(), jogadores_max, tipo_final_para_db, servidor_id)
                )

                nicks_online_brutos = [p.name for p in status.players.sample or []]
                nicks_online_validos = {limpar_formatacao_minecraft(n) for n in nicks_online_brutos if is_valid_minecraft_nick(limpar_formatacao_minecraft(n))}

                if nicks_online_validos:
                    now_iso = datetime.utcnow().isoformat()
                    for nick in nicks_online_validos:
                        await self.bot.db_connection.execute(
                            "INSERT INTO log_jogadores (nome_jogador, servidor_id, data_primeira_vez_visto, data_ultima_vez_visto) VALUES (?, ?, ?, ?) ON CONFLICT(nome_jogador, servidor_id) DO UPDATE SET data_ultima_vez_visto = excluded.data_ultima_vez_visto;",
                            (nick, servidor_id, now_iso, now_iso)
                        )
                
                await self.bot.db_connection.commit()

                embed = discord.Embed(title=f"Relatório: {nome_servidor}", description=f"IP: `{ip}`", color=discord.Color.green())
                embed.add_field(name="Jogadores", value=f"{jogadores_online}/{jogadores_max}", inline=True)
                embed.add_field(name="Ping", value=f"{ping} ms", inline=True)
                embed.add_field(name="Versão", value=versao, inline=True)
                embed.add_field(name="Tipo", value=tipo_final_para_embed, inline=True)
                embed.add_field(name="Localização", value=localizacao_texto, inline=True)
                
                cursor_log = await self.bot.db_connection.execute("SELECT nome_jogador, data_ultima_vez_visto FROM log_jogadores WHERE servidor_id = ? ORDER BY data_ultima_vez_visto DESC LIMIT 1", (servidor_id,))
                ultima_atividade_rec = await cursor_log.fetchone()
                
                ultima_atividade_texto = "Nenhuma atividade registrada."
                if ultima_atividade_rec:
                    fuso_horario = timezone(timedelta(hours=config.FUSO_HORARIO_OFFSET))
                    data_utc = datetime.fromisoformat(ultima_atividade_rec['data_ultima_vez_visto'])
                    data_local = data_utc.astimezone(fuso_horario)
                    ultima_atividade_texto = f"**{limpar_formatacao_minecraft(ultima_atividade_rec['nome_jogador'])}** - visto em {data_local.strftime('%d/%m às %H:%M')}"
                embed.add_field(name="Última Atividade Registrada", value=ultima_atividade_texto, inline=False)

                cursor_nicks = await self.bot.db_connection.execute("SELECT nome_jogador FROM log_jogadores WHERE servidor_id = ?", (servidor_id,))
                todos_nicks_db = {r['nome_jogador'] for r in await cursor_nicks.fetchall()}
                nicks_offline = sorted([limpar_formatacao_minecraft(n) for n in (todos_nicks_db - nicks_online_validos)])
                nicks_offline_texto = ', '.join(nicks_offline) if nicks_offline else "Nenhum jogador conhecido offline."
                embed.add_field(name="Nicks Offline Conhecidos", value=self._truncate_text(nicks_offline_texto), inline=False)

                nicks_online_limpos = sorted(list(nicks_online_validos))
                nicks_online_texto = ', '.join(nicks_online_limpos) if nicks_online_limpos else "Nenhum jogador online."
                embed.add_field(name=f"Nicks Online ({len(nicks_online_limpos)})", value=self._truncate_text(nicks_online_texto), inline=False)
                
                embed.set_thumbnail(url=f"https://api.mcsrvstat.us/icon/{ip}")
                fuso_footer = timezone(timedelta(hours=config.FUSO_HORARIO_OFFSET))
                embed.set_footer(text=f"Verificado em: {discord.utils.utcnow().astimezone(fuso_footer).strftime('%d/%m/%Y às %H:%M:%S')}")

                canal_id_alvo = config.CANAL_PADRAO_ID
                for v_key, c_id in config.CANAIS_POR_VERSAO.items():
                    if v_key in versao:
                        canal_id_alvo = c_id
                        break
                
                if canal_alvo := self.bot.get_channel(canal_id_alvo):
                    await canal_alvo.send(embed=embed)
                    self.logger.info(f"Servidor [{ip}] ONLINE. Relatório enviado para {canal_alvo.name}")
                else:
                    self.logger.error(f"Não foi possível encontrar o canal de destino ID {canal_id_alvo} para {ip}")

            except Exception as e:
                current_failures = self.offline_counters.get(ip, 0) + 1
                self.offline_counters[ip] = current_failures
                self.logger.warning(f"Servidor [{ip}] OFFLINE. Falha nº {current_failures}. Erro: {e.__class__.__name__}: {e}") 

                if current_failures >= config.LIMITE_DE_FALHAS_PARA_PAUSAR:
                    self.logger.error(f"Limite de falhas atingido para [{ip}]. Pausando no DB.")
                    await self.bot.db_connection.execute("UPDATE servidores SET ativo = 0 WHERE ip_servidor = ?", (ip,))
                    await self.bot.db_connection.commit()
                    self.offline_counters.pop(ip, None)
                    if canal_padrao := self.bot.get_channel(config.CANAL_PADRAO_ID):
                        await canal_padrao.send(f"⚠️ O servidor `{ip}` foi pausado após falhar {config.LIMITE_DE_FALHAS_PARA_PAUSAR} vezes.")
            
            await asyncio.sleep(2)

    @monitor_loop.before_loop
    async def before_monitor_loop(self):
        await self.bot.wait_until_ready()

    @tasks.loop()
    async def reverificacao_loop(self):
        self.logger.info("Iniciando ciclo de RE-VERIFICAÇÃO de servidores pausados...")
        cursor = await self.bot.db_connection.execute("SELECT ip_servidor FROM servidores WHERE ativo = 0")
        servidores_pausados = await cursor.fetchall()
        
        if not servidores_pausados:
            self.logger.info("Nenhum servidor pausado para re-verificar.")
            return

        for servidor in servidores_pausados:
            ip = servidor['ip_servidor']
            try:
                server = await self.bot.loop.run_in_executor(None, JavaServer.lookup, ip)
                await server.status()
                self.logger.info(f"SUCESSO! Servidor [{ip}] está online. Reativando.")
                await self.bot.db_connection.execute("UPDATE servidores SET ativo = 1 WHERE ip_servidor = ?", (ip,))
                await self.bot.db_connection.commit()
                
                if canal_padrao := self.bot.get_channel(config.CANAL_PADRAO_ID):
                    await canal_padrao.send(f"✅ O servidor `{ip}` foi reativado automaticamente.")
            except Exception:
                self.logger.info(f"FALHA. Servidor [{ip}] continua offline.")
            
            await asyncio.sleep(2)

    @reverificacao_loop.before_loop
    async def before_reverificacao_loop(self):
        await self.bot.wait_until_ready()

async def setup(bot):
    await bot.add_cog(MonitoringCog(bot))