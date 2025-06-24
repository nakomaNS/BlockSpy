# Monitor de Servidores de Minecraft para Discord

![Status](https://img.shields.io/badge/status-beta%20v1.0-orange)
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
* Uma conta de Bot no [Portal de Desenvolvedores do Discord](https://discord.com/developers/applications)

(É isso! Nenhuma instalação de banco de dados é necessária, pois o bot usa SQLite, que já vem com o Python.)

### Instalação

1.  **Clone o repositório:**
    ```bash
    git clone [https://github.com/seu-usuario/Blockspy.git](https://github.com/seu-usuario/Blockspy.git)
    cd Blockspy
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

4.  **Configure o Bot:**
    * O bot irá te guiar na primeira execução para criar o arquivo `.env` com o seu token.
    * Depois, edite o arquivo `config.py` com os IDs dos seus canais do Discord e o nome do cargo de administrador.

5.  **Rode o bot:**
    ```bash
    python bot.py
    ```
    Na primeira vez, ele pedirá seu token. Depois disso, ele iniciará normalmente. O arquivo do banco de dados (`database.db`) será criado automaticamente na pasta.