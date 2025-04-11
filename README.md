# Backend do Perfil Sensorial 2

Este é o backend para a aplicação de Perfil Sensorial 2, desenvolvido para armazenar e processar dados de avaliações sensoriais de crianças entre 3 e 14 anos.

## Tecnologias Utilizadas

- Node.js com Express.js
- TypeScript
- Prisma ORM
- PostgreSQL
- JWT para autenticação
- Docker para containerização
- Render para hospedagem

## Estrutura do Projeto

```
sensory-profile-backend/
├── src/
│   ├── controllers/     # Controladores para cada entidade
│   ├── models/          # Definições de tipos/interfaces
│   ├── routes/          # Rotas da API
│   ├── services/        # Lógica de negócio
│   ├── utils/           # Funções utilitárias
│   │   └── scoring/     # Cálculos de pontuação
│   ├── middleware/      # Middlewares (auth, validação, etc)
│   ├── prisma/          # Schema e migrações do Prisma
│   └── app.ts           # Configuração do Express
├── tests/               # Testes unitários e de integração
├── Dockerfile           # Configuração do Docker
├── docker-compose.yml   # Configuração para desenvolvimento local
├── package.json
├── tsconfig.json
└── README.md
```

## Configuração do Ambiente de Desenvolvimento

### Pré-requisitos

- Node.js (versão 18 ou superior)
- PostgreSQL (local ou em container Docker)
- npm ou yarn

### Instalação

1. Clone o repositório
   ```bash
   git clone <url-do-repositorio>
   cd sensory-profile-backend
   ```

2. Instale as dependências
   ```bash
   npm install
   ```

3. Configure as variáveis de ambiente
   ```bash
   cp .env.example .env
   # Edite o arquivo .env com suas configurações
   ```

4. Execute as migrações do banco de dados
   ```bash
   npx prisma migrate dev
   ```

5. Inicie o servidor de desenvolvimento
   ```bash
   npm run dev
   ```

## Implantação no Render

### Configuração do Banco de Dados

1. Crie um novo serviço PostgreSQL no Render
   - Acesse o dashboard do Render
   - Clique em "New" e selecione "PostgreSQL"
   - Configure o nome, usuário e senha
   - Clique em "Create Database"

2. Anote a URL de conexão fornecida pelo Render

### Configuração do Serviço Web

1. Crie um novo serviço Web no Render
   - Acesse o dashboard do Render
   - Clique em "New" e selecione "Web Service"
   - Conecte ao repositório GitHub
   - Configure o nome do serviço

2. Configure as variáveis de ambiente
   - DATABASE_URL: URL de conexão do PostgreSQL criado anteriormente
   - JWT_SECRET: Chave secreta para autenticação
   - NODE_ENV: production
   - FRONTEND_URL: URL do frontend

3. Configure o build command
   ```
   npm install && npx prisma generate && npm run build
   ```

4. Configure o start command
   ```
   npm start
   ```

5. Clique em "Create Web Service"

## API Endpoints

### Autenticação
- `POST /api/auth/register` - Registrar novo usuário
- `POST /api/auth/login` - Autenticar usuário

### Crianças
- `GET /api/children` - Listar todas as crianças
- `GET /api/children/:id` - Obter detalhes de uma criança
- `POST /api/children` - Cadastrar nova criança
- `PUT /api/children/:id` - Atualizar dados de uma criança
- `DELETE /api/children/:id` - Remover uma criança

### Examinadores
- `GET /api/examiners` - Listar todos os examinadores
- `GET /api/examiners/:id` - Obter detalhes de um examinador
- `POST /api/examiners` - Cadastrar novo examinador
- `PUT /api/examiners/:id` - Atualizar dados de um examinador
- `DELETE /api/examiners/:id` - Remover um examinador

### Cuidadores
- `GET /api/caregivers` - Listar todos os cuidadores
- `GET /api/caregivers/:id` - Obter detalhes de um cuidador
- `POST /api/caregivers` - Cadastrar novo cuidador
- `PUT /api/caregivers/:id` - Atualizar dados de um cuidador
- `DELETE /api/caregivers/:id` - Remover um cuidador

### Avaliações
- `GET /api/assessments` - Listar todas as avaliações
- `GET /api/assessments/:id` - Obter detalhes de uma avaliação
- `POST /api/assessments` - Cadastrar nova avaliação (com respostas)
- `PUT /api/assessments/:id` - Atualizar uma avaliação
- `DELETE /api/assessments/:id` - Remover uma avaliação
- `GET /api/assessments/:id/report` - Gerar relatório de uma avaliação

### Itens do Questionário
- `GET /api/items` - Listar todos os itens
- `GET /api/items/:section` - Listar itens por seção

## Cálculo de Pontuações

O sistema calcula automaticamente as pontuações brutas para cada seção do questionário:

1. Processamento Auditivo
2. Processamento Visual
3. Processamento Tátil
4. Processamento de Movimento
5. Processamento de Posição do Corpo
6. Processamento de Sensibilidade Oral
7. Respostas Socioemocionais
8. Respostas de Atenção

Além disso, calcula as pontuações por quadrante:
- Registro Aumentado (RA)
- Busca Sensorial (BS)
- Sensibilidade Sensorial (SS)
- Evitação Sensorial (ES)

## Licença

Este projeto está licenciado sob a licença MIT - consulte o arquivo LICENSE para obter detalhes.
