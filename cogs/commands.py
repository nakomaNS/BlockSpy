# cogs/commands.py
import discord
from discord.ext import commands
import re
import asyncio
import os
import logging
from mcstatus import JavaServer

import config

IP_DOMAIN_REGEX = re.compile(r"^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,6}(?::\d+)?$|^(?:[0-9]{1,3}\.){3}[0-9]{1,3}(?::\d+)?$")

async def _processa_e_adiciona_ip(bot, ip_servidor: str):
    """Processa um único IP, verifica sua validade e o adiciona ao banco de dados SQLite."""
    cursor = await bot.db_connection.execute("SELECT id FROM servidores WHERE ip_servidor = ?", (ip_servidor,))
    servidor_existente = await cursor.fetchone()
    
    if servidor_existente:
        return f"⚠️ IP `{ip_servidor}` já existe no banco de dados."
    
    try:
        await bot.loop.run_in_executor(None, JavaServer.lookup(ip_servidor).status)
        await bot.db_connection.execute("INSERT INTO servidores (ip_servidor, nome_servidor, ativo) VALUES (?, ?, ?)", (ip_servidor, 'Verificado', 1))
        await bot.db_connection.commit()
        return f"✅ IP `{ip_servidor}` verificado e adicionado como **ativo**."
    except Exception:
        await bot.db_connection.execute("INSERT INTO servidores (ip_servidor, nome_servidor, ativo) VALUES (?, ?, ?)", (ip_servidor, 'Aguardando verificação...', 0))
        await bot.db_connection.commit()
        return f"❌ Não foi possível conectar a `{ip_servidor}`. Adicionado como **pausado**."

class CommandsCog(commands.Cog):
    def __init__(self, bot):
        self.bot = bot
        self.logger = logging.getLogger(f"cogs.{self.__class__.__name__}")
        self.logger.info("Cog de Comandos carregado.")

    @commands.command(name='add')
    @commands.has_role(config.NOME_CARGO_ADMIN)
    async def add_servidor(self, ctx, ip_servidor: str):
        """Adiciona um único servidor à lista de monitoramento."""
        if not IP_DOMAIN_REGEX.match(ip_servidor):
            await ctx.send(f"⚠️ O endereço `{ip_servidor}` não parece um IP ou domínio válido.")
            return

        async with ctx.typing():
            resultado = await _processa_e_adiciona_ip(self.bot, ip_servidor)
        await ctx.send(resultado)

    @commands.command(name='pause')
    @commands.has_role(config.NOME_CARGO_ADMIN)
    async def pause_servidor(self, ctx, ip_servidor: str):
        """Pausa o monitoramento de um servidor."""
        cursor = await self.bot.db_connection.execute("UPDATE servidores SET ativo = 0 WHERE ip_servidor = ?", (ip_servidor,))
        await self.bot.db_connection.commit()

        if cursor.rowcount > 0:
            await ctx.send(f"⏸️ O monitoramento para `{ip_servidor}` foi **pausado**.")
            self.logger.info(f"Servidor {ip_servidor} pausado por {ctx.author}.")
        else:
            await ctx.send(f"🤔 Não encontrei `{ip_servidor}` no banco de dados.")

    # --- NOVO COMANDO ---
    @commands.command(name='resume')
    @commands.has_role(config.NOME_CARGO_ADMIN)
    async def resume_servidor(self, ctx, ip_servidor: str):
        """Reativa o monitoramento de um servidor pausado."""
        cursor = await self.bot.db_connection.execute("UPDATE servidores SET ativo = 1 WHERE ip_servidor = ?", (ip_servidor,))
        await self.bot.db_connection.commit()

        if cursor.rowcount > 0:
            await ctx.send(f"▶️ O monitoramento para `{ip_servidor}` foi **reativado**.")
            self.logger.info(f"Servidor {ip_servidor} reativado pelo usuário {ctx.author}.")
        else:
            await ctx.send(f"🤔 Não encontrei `{ip_servidor}` no banco de dados.")

    @commands.command(name='list_servers')
    @commands.has_role(config.NOME_CARGO_ADMIN)
    async def list_servers(self, ctx):
        """Lista todos os servidores monitorados."""
        cursor = await self.bot.db_connection.execute("SELECT ip_servidor, ativo FROM servidores ORDER BY id")
        servidores = await cursor.fetchall()
        
        if not servidores:
            await ctx.send("Nenhum servidor na lista. Use `!add <ip>` para adicionar.")
            return

        embed = discord.Embed(title="Servidores Monitorados", color=discord.Color.blue())
        ativos = "\n".join([f"`{s['ip_servidor']}`" for s in servidores if s['ativo'] == 1])
        pausados = "\n".join([f"`{s['ip_servidor']}`" for s in servidores if s['ativo'] == 0])
            
        if ativos: embed.add_field(name="▶️ Ativos", value=ativos, inline=False)
        if pausados: embed.add_field(name="⏸️ Pausados", value=pausados, inline=False)
        
        await ctx.send(embed=embed)

    # (os outros comandos como addlist e processar_lista permanecem os mesmos)
    # ...

    @commands.Cog.listener()
    async def on_command_error(self, ctx, error):
        if isinstance(error, commands.MissingRole):
            await ctx.send(f"❌ Você não tem permissão. É necessário o cargo `{config.NOME_CARGO_ADMIN}`.")
        elif isinstance(error, commands.CommandNotFound):
            pass
        elif isinstance(error, commands.MissingRequiredArgument):
            await ctx.send(f"😕 Está faltando um argumento para o comando. Use `!help {ctx.command}` para ver como usar.")
        else:
            self.logger.error(f"Erro não tratado no comando '{ctx.command}': {error}")
            await ctx.send("😕 Ocorreu um erro inesperado. O erro foi registrado.")

async def setup(bot):
    await bot.add_cog(CommandsCog(bot))