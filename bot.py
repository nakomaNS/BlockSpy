# bot.py
import discord
from discord.ext import commands
import os
import aiosqlite
import asyncio
import logging
import re
from dotenv import load_dotenv

load_dotenv()
DISCORD_TOKEN = os.getenv("DISCORD_TOKEN")

if not DISCORD_TOKEN:
    print("👋 Bem-vindo ao Griffcrawler Bot! Parece que esta é a sua primeira execução.")
    print("Para funcionar, eu preciso do Token do seu Bot do Discord.")
    print("Você pode encontrá-lo no Portal de Desenvolvedores do Discord, na aba 'Bot'.")
    
    token_regex = re.compile(r"^[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]{5,}\.[a-zA-Z0-9_-]{25,}$")

    while True:
        token_inserido = input("\nPor favor, cole o token aqui e aperte Enter: ")

        # --- CORREÇÃO AQUI ---
        if not token_inserido:
            print("❌ Você não inseriu nada. Por favor, tente novamente.")
            continue # Pula para a próxima iteração do loop, pedindo o token de novo

        if token_regex.match(token_inserido):
            with open('.env', 'w', encoding='utf-8') as f:
                f.write(f'DISCORD_TOKEN="{token_inserido}"\n')
            
            print("\n✅ Perfeito! Token com formato válido salvo no arquivo .env.")
            print("Por favor, inicie o bot novamente com o comando: python bot.py")
            exit()
        else:
            print("\n❌ O texto inserido não parece ter um formato de token válido.")
            print("   Um token válido é uma longa sequência de caracteres separada por pontos.")
            print("   Por favor, copie e cole o token completo novamente.")

try:
    import config
except ImportError:
    print("🚨 ERRO: O arquivo 'config.py' não foi encontrado ou está com erro de sintaxe.")
    print("Por favor, copie e edite o arquivo config.py que está no projeto do GitHub.")
    exit()

logger = logging.getLogger('discord')
logger.setLevel(logging.INFO)
handler = logging.FileHandler(filename='discord_bot.log', encoding='utf-8', mode='w')
handler.setFormatter(logging.Formatter('%(asctime)s:%(levelname)s:%(name)s: %(message)s'))
logger.addHandler(handler)

intents = discord.Intents.default()
intents.message_content = True
bot = commands.Bot(command_prefix=config.PREFIXO_COMANDO, intents=intents)

async def criar_tabelas(db_connection):
    await db_connection.execute("""
        CREATE TABLE IF NOT EXISTS servidores (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ip_servidor TEXT UNIQUE NOT NULL,
            nome_servidor TEXT,
            ultima_verificacao TEXT,
            jogadores_maximos INTEGER DEFAULT 0,
            ativo INTEGER DEFAULT 1,
            tipo TEXT DEFAULT 'Indeterminado'
        );
    """)
    await db_connection.execute("""
        CREATE TABLE IF NOT EXISTS log_jogadores (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome_jogador TEXT NOT NULL,
            servidor_id INTEGER,
            data_primeira_vez_visto TEXT,
            data_ultima_vez_visto TEXT,
            FOREIGN KEY(servidor_id) REFERENCES servidores(id) ON DELETE CASCADE,
            UNIQUE (nome_jogador, servidor_id)
        );
    """)
    await db_connection.commit()
    logger.info("✅ Estrutura do banco de dados SQLite verificada/criada com sucesso.")


@bot.event
async def on_ready():
    logger.info(f'Bot {bot.user} está online e pronto!')
    activity = discord.Activity(name="servidores de Minecraft", type=discord.ActivityType.watching)
    await bot.change_presence(activity=activity)
    logger.info(f"Status de atividade do bot definido como: 'Observando servidores de Minecraft'")


async def main():
    try:
        bot.db_connection = await aiosqlite.connect("database.db") 
        bot.db_connection.row_factory = aiosqlite.Row 
        logger.info("✅ Conexão com o banco de dados SQLite 'database.db' estabelecida.")
        
        await criar_tabelas(bot.db_connection)

    except Exception as e:
        logger.critical(f"🚨 ERRO CRÍTICO durante a inicialização do DB SQLite. O bot não pode iniciar. Erro: {e}")
        return

    async with bot:
        logger.info("--- Carregando Cogs ---")
        for filename in os.listdir('./cogs'):
            if filename.endswith('.py') and not filename.startswith('__'):
                try:
                    await bot.load_extension(f'cogs.{filename[:-3]}')
                    logger.info(f"✅ Cog '{filename[:-3]}' carregado.")
                except Exception as e:
                    logger.error(f"🔥 Falha ao carregar o Cog '{filename[:-3]}'. Erro: {e}")
        logger.info("----------------------")
        
        await bot.start(DISCORD_TOKEN)

    await bot.db_connection.close()
    logger.info("Conexão com o banco de dados SQLite fechada.")


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("Bot desligado manualmente pelo usuário.")