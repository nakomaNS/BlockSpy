# =====================================================================================
# CONFIGURAÇÃO GERAL DO BOT - Edite os valores abaixo conforme sua necessidade.
# =====================================================================================

# ---------------------- Configurações do Discord ----------------------

# Nome do cargo do discord com permissão de admin (sensível a maiúsculas/minúsculas).
NOME_CARGO_ADMIN = "Dono"

# Caractere usado antes de cada comando (ex: "!", "?").
PREFIXO_COMANDO = "!"

# ID do canal principal para enviar relatórios e alertas.
CANAL_PADRAO_ID = 123456789012345678

# Envia relatórios para canais específicos por versão do servidor.
# Deixe vazio como {} para desativar.
CANAIS_POR_VERSAO = {
    # Formato correto: 
    # "1.21.6": 123456789012345679,
}


# ---------------- Configurações de Monitoramento ---------------------

# Intervalo (em segundos) para verificar servidores ativos.
INTERVALO_SEGUNDOS_ONLINE = 30

# Número de falhas consecutivas para um servidor ser pausado.
LIMITE_DE_FALHAS_PARA_PAUSAR = 3

# Intervalo (em segundos) para tentar reativar servidores pausados.
INTERVALO_SEGUNDOS_REVERIFICACAO = 1800

# Seu fuso horário em relação ao UTC/GMT (ex: Brasil = -3).
FUSO_HORARIO_OFFSET = -3