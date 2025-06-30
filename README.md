# BlockSpy Beta v2.0
![Licença](https://img.shields.io/github/license/nakomaNS/blockspy?style=for-the-badge)



BlockSpy é uma suíte de monitoramento completa que oferece dados em tempo real, históricos detalhados e ferramentas de gerenciamento diretamente no seu navegador. Com uma interface limpa e reativa, você tem controle total sobre seus servidores, seja um, ou uma centena.

![Imagem Dashboard](https://i.imgur.com/okpOW6t.png)
![Imagem Info do Servidor](https://i.imgur.com/n2nCs2a.png)

---

## ✨ Principais funcionalidades

* **📊 Dashboard Centralizado:** Visualize todos os seus servidores em um grid dinâmico, com status em tempo real (online/offline/pausado), contagem de jogadores, ping e versão.
* **📈 Gráficos Detalhados:** Analise o histórico de atividade de cada servidor com gráficos interativos de jogadores, ping, lotação e variação de entrada/saída.
* **🗓️ Heatmaps de Atividade:** Descubra os horários de pico do seu servidor com um heatmap de calendário e um heatmap de atividade por dia/hora.
* **🔴 Console Ao Vivo:** Conecte-se diretamente ao console do seu servidor via RCON (remoto) ou acompanhe o `latest.log` em tempo real (localmente).
* **📜 Timeline de Eventos:** Nunca perca um acontecimento! Veja um histórico de quando o servidor ligou/desligou, jogadores entraram/saíram e novos recordes foram batidos.
* **🕵️ Detecção de Servidor:** Identifica automaticamente se um servidor é **Original** (online-mode=true) ou **Pirata** (online-mode=false).
* **🌍 Geolocalização:** Mostra a bandeira e o país de origem do servidor.
* **➕ Adição em Massa:** Adicione servidores um por um, em lote, ou importando um arquivo `.txt`.
* **✏️ Gerenciamento Completo:** Edite, pause, remova e configure cada servidor individualmente através de um modal intuitivo.
* **🌗 Tema Claro & Escuro:** Adapte a aparência para o seu gosto.

---

## Como executar:

**Pré-requisitos:**
* **Python 3.8+** e **Git** instalados.
* **Usuários Windows:** Na instalação do Python, marque a caixa **"Add Python to PATH"**.

---

### Instruções

1.  **Clone o projeto e entre na pasta:**
    ```sh
    git clone https://github.com/nakomaNS/blockspy
    cd BlockSpy
    ```

2.  **Execute o Lançador:**
    O script irá criar o ambiente virtual, instalar as dependências e iniciar a aplicação.

    * #### 🐧 No Linux ou macOS:
        Primeiro, dê permissão de execução (só uma vez):
        ```sh
        chmod +x start.sh
        ```
        Depois, execute com:
        ```sh
        ./start.sh
        ```
2.  **Versão de Windows em breve**

---

Para parar o servidor, pressione `CTRL+C` no terminal.
