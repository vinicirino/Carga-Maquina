# 🏭 PCP Industrial — Sistema de Gestão e Análise de Carga Máquina & Capacidade Fabril

Sistema corporativo para planejamento e controle da produção (PCP), balanceamento de capacidade instalada por centros de trabalho, simulação de turnos, cálculo de curva S paramétrica de turbinas e análise de gargalos fabris.

---

## 📋 Sumário
- [Recursos Principais](#-recursos-principais)
- [Como Subir este Projeto no GitHub](#-como-subir-este-projeto-no-github)
- [Como Implantar no Servidor da Empresa](#-como-implantar-no-servidor-da-empresa)
  - [Opção 1: Docker & Docker Compose (Recomendado)](#opção-1-docker--docker-compose-recomendado)
  - [Opção 2: Servidor Web Nginx (Linux)](#opção-2-servidor-web-nginx-linux)
  - [Opção 3: Node.js com PM2](#opção-3-nodejs-com-pm2)
- [Como Inicializar com os Dados Reais da sua Empresa](#-como-inicializar-com-os-dados-reais-da-sua-empresa)
- [Formatos de Importação e Integração com ERP](#-formatos-de-importação-e-integração-com-erp)
- [Estrutura do Repositório](#-estrutura-do-repositório)

---

## ✨ Recursos Principais

1. **Gestão de Centros de Trabalho & Postos**:
   - Cadastro com horas/dia, dias/semana, número de recursos e eficiência (%).
   - Classificação em **Agrupadores de Setor** (ex: *CORTE, CALDEIRARIA, SOLDA, USINAGEM, MONTAGENS, ACABAMENTOS*).
   - Ocultação e desconsideração automática de postos com 0h alocadas no cenário ativo.

2. **Cronograma com Prazos por Setor (Group Dates)**:
   - Configuração de datas de início e fim por projeto e por setor.
   - Detecção automática de sobreposições e semanas fora de vigência.

3. **Novo Projeto Paramétrico de Turbinas (Curva S Industrial)**:
   - Modelagem de curvas de avanço paramétricas (Linear, Gaussiana, Logística/S, Carga Inicial, Carga Final).
   - Distribuição automática de horas por centros de trabalho conforme o modelo de turbina.

4. **Painel de Simulações & Otimização de Turnos**:
   - Simulação interativa de deslocamento de cronograma (dias para frente/trás).
   - Sugestão automática de ampliação de recursos para eliminação de sobrecarga.
   - Aplicação e salvamento instantâneo de cenários alternativos.

5. **Matriz de Carga Semanal (Heatmap Fabril)**:
   - Visão bidimensional de postos × semanas com escalas de calor de ocupação (0% a >130%).

6. **Comparador e Gestor de Cenários**:
   - Criação, duplicação e comparação lado a lado de múltiplos cenários de planejamento.
   - Fixação e persistência de **Base Primária Oficial (Baseline)**.

---

## 🚀 Como Subir este Projeto no GitHub

Abra o terminal na pasta do projeto e execute os seguintes comandos:

```bash
# 1. Inicialize o repositório git local (se ainda não estiver inicializado)
git init

# 2. Adicione todos os arquivos do projeto
git add .

# 3. Crie o commit inicial da versão de produção
git commit -m "feat: versão final de produção do sistema PCP Carga Máquina"

# 4. Defina a branch principal como main
git branch -M main

# 5. Adicione a URL do seu repositório remoto no GitHub (substitua pela sua URL)
git remote add origin https://github.com/SEU_USUARIO/pcp-analise-carga-maquina.git

# 6. Envie o código para o GitHub
git push -u origin main
```

---

## 🏢 Como Implantar no Servidor da Empresa

### Opção 1: Docker & Docker Compose (Recomendado)

O projeto já inclui um `Dockerfile` multi-stage otimizado com Nginx Alpine (~25MB) e um `docker-compose.yml` pronto para produção.

```bash
# No servidor da empresa, clone o repositório:
git clone https://github.com/SEU_USUARIO/pcp-analise-carga-maquina.git
cd pcp-analise-carga-maquina

# Suba a aplicação em segundo plano (porta 3000):
docker compose up -d --build
```

Acesse no navegador:
- Local: `http://localhost:3000`
- Na rede interna da empresa: `http://IP_DO_SERVIDOR:3000`
- Health check: `http://IP_DO_SERVIDOR:3000/api/health`

---

### Opção 2: Servidor Web Nginx (Linux Ubuntu / Debian)

Para rodar diretamente no Nginx do seu servidor:

```bash
# 1. Instale as dependências e faça o build
npm install
npm run build

# 2. Copie a pasta dist para a pasta pública do Nginx
sudo cp -r dist/* /var/www/html/pcp/

# 3. Configure o virtual host no Nginx (/etc/nginx/sites-available/pcp):
```

Exemplo de bloco no Nginx:
```nginx
server {
    listen 80;
    server_name pcp.suaempresa.com.br;

    root /var/www/html/pcp;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

Recarregue o Nginx:
```bash
sudo systemctl reload nginx
```

---

### Opção 3: Node.js com PM2

Caso queira executar via servidor Express Node.js nativo:

```bash
# 1. Instale as dependências e compile os fontes
npm install
npm run build

# 2. Inicie o servidor com PM2 (gerenciador de processos)
npm install -g pm2
pm2 start server.js --name "pcp-sistema" -i max

# 3. Configure para reiniciar automaticamente com o sistema operacional
pm2 save
pm2 startup
```

---

## 🧹 Como Inicializar com os Dados Reais da sua Empresa

1. No cabeçalho da aplicação, clique no botão **🔄 (Gestão e Limpeza do Banco de Dados)**.
2. Selecione a opção **"Inicializar Base de Produção da Empresa (0 Projetos)"**.
3. O sistema criará uma base limpa com todos os centros de trabalho e agrupadores prontos, permitindo que você:
   - Cadastre projetos manualmente pelo botão **"Novo Projeto"** ou **"Novo Projeto Personalizado"**.
   - Importe em lote seus projetos via **Planilha Excel/CSV** ou **JSON Estruturado**.
4. Após cadastrar a carga fabril real da empresa, clique em **"Salvar como Base Primária Oficial"** no Gestor de Cenários para fixar a baseline corporativa.

---

## 📊 Formatos de Importação e Integração com ERP

O sistema aceita dois métodos práticos de importação em massa:

### 1. Importação por Planilha Excel / CSV (Matriz de Projetos)
Clique em **"Importar / Exportar JSON"** ➔ **"Importar Planilha (Matriz)"**:
- **Linhas**: Centros de trabalho cadastrados no ERP.
- **Colunas**: Nome dos projetos e as horas alocadas para cada máquina/posto.
- Baixe o modelo `.xlsx` de exemplo diretamente pela tela de importação.

### 2. Importação por JSON Estruturado v2.0
Suporta exportação e importação completa de todos os cenários, postos, eficiências e datas por setor (`groupDates`).

---

## 📁 Estrutura do Repositório

```text
├── Dockerfile                   # Build multi-stage Node + Nginx Alpine para produção
├── docker-compose.yml           # Orquestração do container na porta 3000
├── nginx.conf                   # Configuração Nginx com gzip, cache e SPA fallback
├── server.js                    # Servidor Express de produção para Node/PM2
├── package.json                 # Dependências e scripts de automação
├── src/
│   ├── components/              # Componentes de interface (Dashboards, Modais, Gráficos)
│   ├── data/                    # Modelos de turbina, cenários e sementes de dados
│   ├── types/                   # Tipagens TypeScript (WorkCenter, Project, Scenario)
│   └── utils/                   # Motores de cálculo de capacidade, curva S e importadores
└── dist/                        # Build compilado de produção (gerado por npm run build)
```

---

## 🛠️ Comandos de Desenvolvimento

```bash
# Iniciar servidor de desenvolvimento com hot-reload
npm run dev

# Validar TypeScript e sintaxe
npm run lint

# Gerar build de produção
npm run build

# Pré-visualizar o build localmente
npm run preview
```

Pronto para produção corporativa! 🚀
