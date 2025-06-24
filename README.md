# Monitor de Servidores de Minecraft para Discord

![Licença](https://img.shields.io/github/license/seu-usuario/seu-repositorio?style=for-the-badge)
![Linguagem](https://img.shields.io/github/languages/top/seu-usuario/seu-repositorio?style=for-the-badge)

Um bot de Discord robusto e customizável para monitorar múltiplos servidores de Minecraft em tempo real, registrando atividade de jogadores e enviando relatórios detalhados para canais específicos.

![Exemplo do Embed do Bot](https://i.imgur.com/link_para_sua_imagem.png)  
*(Dica: Tire um print do embed do bot em ação, suba em um site como o [Imgur](https://imgur.com/upload) e cole o link direto da imagem aqui)*

##  sobre o Projeto

Este bot foi desenvolvido para administradores de servidores e comunidades que precisam de uma forma automatizada e centralizada para verificar o status de seus servidores de Minecraft. Ele utiliza programação assíncrona, se conecta a um banco de dados PostgreSQL para persistência de dados e é totalmente configurável através de arquivos simples, permitindo uma fácil adaptação para diferentes necessidades.

### Principais Funcionalidades

* ✅ **Monitoramento Contínuo:** Verifica servidores ativos em intervalos regulares e configuráveis.
* ⏸️ **Pause e Reativação Automática:** Pausa automaticamente o monitoramento de servidores que falham consecutivamente e tenta reativá-los periodicamente.
* 📊 **Relatórios Detalhados:** Envia um embed rico no Discord com informações como ping, versão, número de jogadores, tipo de servidor (Original/Pirata) e localização geográfica.
* ✍️ **Log de Jogadores:** Registra os nicks de todos os jogadores que entram nos servidores, guardando a data e a hora da última vez que foram vistos.
* 🔀 **Roteamento por Versão:** Capacidade de enviar relatórios para canais diferentes com base na versão do servidor de Minecraft.
* 🔒 **Seguro e Configurável:** Usa variáveis de ambiente para dados sensíveis e um arquivo de configuração central para fácil customização de IDs de canais, tempos e permissões.
* ⚙️ **Estrutura Profissional:** Organizado em Cogs (`discord.py`) para fácil manutenção e escalabilidade.

## Começando

Para rodar uma instância própria deste bot, siga os passos abaixo.

### Pré-requisitos

* Python 3.8 ou superior
* Um servidor de banco de dados PostgreSQL ativo
* Uma conta de Bot no [Portal de Desenvolvedores do Discord](https://discord.com/developers/applications)

### Instalação

1.  **Clone o repositório:**
    ```bash
    git clone [https://github.com/seu-usuario/seu-repositorio.git](https://github.com/seu-usuario/seu-repositorio.git)
    cd seu-repositorio
    ```

2.  **Crie e ative um ambiente virtual (altamente recomendado):**
    ```bash
    # Windows
    python -m venv venv
    .\venv\Scripts\activate

    # Linux / macOS
    python3 -m venv venv
    source venv/bin/activate
    ```

3.  **Instale todas as dependências:**
    ```bash
    pip install -r requirements.txt
    ```

4.  **Configure o Banco de Dados:**
    * No seu servidor PostgreSQL, crie um banco de dados e um usuário para o bot. Garanta que o usuário tenha permissões para criar tabelas e ler/escrever dados nesse banco.
    * O bot criará as tabelas `servidores` e `log_jogadores` automaticamente na primeira vez que for executado.

5.  **Configure as Variáveis de Ambiente:**
    * Crie um arquivo chamado `.env` na raiz do projeto.
    * Preencha com seus dados sensíveis. Ele deve se parecer com isto:
      ```env
      # Arquivo .env
      DISCORD_TOKEN="O_TOKEN_DO_SEU_BOT_AQUI"
      DB_USER="seu_usuario_db"
      DB_PASSWORD="sua_senha_db"
      DB_DATABASE="nome_do_seu_db"
      DB_HOST="localhost"
      DB_PORT="5432"
      ```

6.  **Configure o Bot:**
    * Copie o arquivo `config_template.py` e renomeie a cópia para `config.py`.
    * Edite o `config.py` com os IDs dos seus canais do Discord e o nome exato do cargo que terá permissão para usar os comandos.

7.  **Rode o bot:**
    ```bash
    python bot.py
    ```
    O bot irá iniciar e começar os ciclos de monitoramento. Verifique o arquivo `discord_bot.log` para acompanhar a atividade.

## Comandos

Os seguintes comandos estão disponíveis para usuários com o cargo definido no `config.py`:

* `!add <ip:porta>`: Adiciona e ativa um novo servidor para monitoramento.
* `!pause <ip:porta>`: Pausa o monitoramento de um servidor.
* `!list_servers`: Lista todos os servidores sendo monitorados e seu status (Ativos/Pausados).
* *(Adicione aqui os outros comandos como `addlist` e `processar_lista`)*

## Licença

Distribuído sob a Licença MIT. Veja o arquivo `LICENSE` para mais informações.

---
Feito com ❤️ por [Seu Nome ou Nick](https://github.com/seu-usuario)