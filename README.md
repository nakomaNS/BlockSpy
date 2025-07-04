# BlockSpy Beta v2.0
![Licença](https://img.shields.io/github/license/nakomaNS/blockspy?style=for-the-badge)

BlockSpy é uma suíte de monitoramento completa que oferece dados em tempo real, históricos detalhados e ferramentas de gerenciamento diretamente no seu navegador. Com uma interface limpa e reativa, você tem controle total sobre seus servidores, seja um, ou uma centena.

![Imagem Dashboard](https://i.imgur.com/okpOW6t.png)
![Imagem Info do Servidor](https://i.imgur.com/n2nCs2a.png)

---

## Principais Funcionalidades

* **Dashboard Centralizado:** Visualize todos os seus servidores em um grid dinâmico, com status em tempo real (online/offline/pausado), contagem de jogadores, ping e versão.
* **Gráficos Detalhados:** Analise o histórico de atividade de cada servidor com gráficos interativos de jogadores, ping, lotação e variação de entrada/saída.
* **Heatmaps de Atividade:** Descubra os horários de pico do seu servidor com um heatmap de calendário e um heatmap de atividade por dia/hora.
* **Console Ao Vivo:** Conecte-se diretamente ao console do seu servidor via RCON (remoto) ou acompanhe o `latest.log` em tempo real (localmente).
* **Timeline de Eventos:** Nunca perca um acontecimento! Veja um histórico de quando o servidor ligou/desligou, jogadores entraram/saíram e novos recordes foram batidos.
* **Detecção de Servidor:** Identifica automaticamente se um servidor é **Original** (online-mode=true) ou **Pirata** (online-mode=false).
* **Geolocalização:** Mostra a bandeira e o país de origem do servidor.
* **Adição em Massa:** Adicione servidores um por um, em lote, ou importando um arquivo `.txt`.
* **Gerenciamento Completo:** Edite, pause, remova e configure cada servidor individualmente através de um modal intuitivo.
* **Tema Claro & Escuro:** Adapte a aparência para o seu gosto.
* **Desligamento Integrado:** Feche a aplicação de forma segura diretamente pela interface (na versão Windows).

---

## Download e Instalação

**Windows**

Para usar o BlockSpy no Windows, basta baixar o executável. Não é necessário instalar Python nem nenhuma outra dependência.

Clique no link abaixo para baixar a versão mais recente. Depois, é só colocar o arquivo em qualquer pasta e dar um duplo clique para executar!

[**Baixar BlockSpy para Windows (.exe)**](https://github.com/nakomaNS/blockspy/releases/download/2.0/BlockSpy.exe)

*Observação: Por ser um software de um desenvolvedor independente, o Windows pode exibir um aviso de segurança (SmartScreen). Se isso acontecer, clique em "Mais informações" e depois em "Executar assim mesmo".*

---

## Executando a Partir do Código-Fonte

**Linux (Ubuntu/Debian) e Desenvolvedores**

Para usuários de Linux, ou desenvolvedores em qualquer plataforma, a execução é feita diretamente a partir do código-fonte.

**Pré-requisitos:**
* **Python 3.8+** e **Git** instalados.

**Instruções:**

1.  Clone o repositório e entre na pasta do projeto:
    ```sh
    git clone [https://github.com/nakomaNS/blockspy.git](https://github.com/nakomaNS/blockspy.git)
    cd blockspy
    ```

2.  Crie um ambiente virtual e instale as dependências:
    ```sh
    python3 -m venv venv
    source venv/bin/activate  # No Windows, use: venv\Scripts\activate
    pip install -r requirements.txt
    ```

3.  Inicie a aplicação. Você pode usar o script de atalho (Linux/macOS) ou o comando uvicorn (todas as plataformas).

    * **Modo Simples (Linux/macOS):**
      ```sh
      # Dê permissão de execução (só na primeira vez)
      chmod +x start.sh
      # Execute
      ./start.sh
      ```
 
    * **Modo Manual (Todas as Plataformas):**
      ```sh
      uvicorn web.main:app --reload
      ```

4.  Para parar a aplicação, pressione `CTRL+C` no terminal.
