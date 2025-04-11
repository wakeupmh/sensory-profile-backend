# Plano de Implementação do Backend para o Perfil Sensorial 2

## 1. Estrutura do Projeto

### 1.1 Tecnologias a serem utilizadas
- **Node.js** com **Express.js** para o servidor
- **TypeScript** para tipagem estática
- **Prisma ORM** para interação com o banco de dados PostgreSQL
- **Jest** para testes
- **Docker** para containerização
- **Render** para hospedagem do backend e banco de dados

### 1.2 Estrutura de diretórios
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

## 2. Implementação do Banco de Dados

### 2.1 Configuração do PostgreSQL no Render
1. Criar um novo serviço PostgreSQL no Render
2. Configurar o banco de dados com nome, usuário e senha seguros
3. Habilitar backup automático (diário)
4. Configurar SSL para conexões seguras

### 2.2 Implementação do Schema com Prisma
1. Inicializar o Prisma no projeto
   ```bash
   npx prisma init
   ```
2. Converter o schema SQL existente para o formato do Prisma
3. Configurar a conexão com o banco de dados usando variáveis de ambiente
4. Gerar o cliente Prisma
   ```bash
   npx prisma generate
   ```
5. Executar a migração inicial
   ```bash
   npx prisma migrate dev --name init
   ```

## 3. Desenvolvimento da API

### 3.1 Endpoints da API

#### Crianças
- `GET /api/children` - Listar todas as crianças
- `GET /api/children/:id` - Obter detalhes de uma criança
- `POST /api/children` - Cadastrar nova criança
- `PUT /api/children/:id` - Atualizar dados de uma criança
- `DELETE /api/children/:id` - Remover uma criança

#### Examinadores
- `GET /api/examiners` - Listar todos os examinadores
- `GET /api/examiners/:id` - Obter detalhes de um examinador
- `POST /api/examiners` - Cadastrar novo examinador
- `PUT /api/examiners/:id` - Atualizar dados de um examinador
- `DELETE /api/examiners/:id` - Remover um examinador

#### Cuidadores
- `GET /api/caregivers` - Listar todos os cuidadores
- `GET /api/caregivers/:id` - Obter detalhes de um cuidador
- `POST /api/caregivers` - Cadastrar novo cuidador
- `PUT /api/caregivers/:id` - Atualizar dados de um cuidador
- `DELETE /api/caregivers/:id` - Remover um cuidador

#### Avaliações
- `GET /api/assessments` - Listar todas as avaliações
- `GET /api/assessments/:id` - Obter detalhes de uma avaliação
- `POST /api/assessments` - Cadastrar nova avaliação (com respostas)
- `PUT /api/assessments/:id` - Atualizar uma avaliação
- `DELETE /api/assessments/:id` - Remover uma avaliação
- `GET /api/assessments/:id/report` - Gerar relatório de uma avaliação

#### Itens do Questionário
- `GET /api/items` - Listar todos os itens
- `GET /api/items/:section` - Listar itens por seção

### 3.2 Implementação do Cálculo de Pontuações

Criar um serviço dedicado para cálculo de pontuações que:

1. Recebe as respostas de uma avaliação
2. Converte as respostas textuais em valores numéricos:
   - Sempre = 5
   - Frequentemente = 4
   - Ocasionalmente = 3
   - Raramente = 2
   - Nunca = 1
3. Calcula as pontuações brutas para cada seção:
   - Processamento Auditivo
   - Processamento Visual
   - Processamento Tátil
   - Processamento de Movimento
   - Processamento de Posição do Corpo
   - Processamento de Sensibilidade Oral
   - Respostas Socioemocionais
   - Respostas de Atenção
4. Calcula as pontuações por quadrante:
   - Registro Aumentado (RA)
   - Busca Sensorial (BS)
   - Sensibilidade Sensorial (SS)
   - Evitação Sensorial (ES)
5. Gera classificações baseadas nas pontuações (Típico, Diferença Provável, Diferença Definitiva)

Exemplo de implementação do serviço de pontuação:

```typescript
// src/services/scoringService.ts

export enum ResponseValue {
  NEVER = 1,
  RARELY = 2,
  OCCASIONALLY = 3,
  FREQUENTLY = 4,
  ALWAYS = 5
}

export const calculateRawScores = (responses: Array<{ itemId: number, response: string }>) => {
  // Mapear respostas para valores numéricos
  const scoredResponses = responses.map(response => ({
    itemId: response.itemId,
    value: mapResponseToValue(response.response)
  }));

  // Calcular pontuações por seção
  const auditoryProcessingScore = calculateSectionScore(scoredResponses, 'auditoryProcessing');
  const visualProcessingScore = calculateSectionScore(scoredResponses, 'visualProcessing');
  // ... outras seções

  // Calcular pontuações por quadrante
  const registrationScore = calculateQuadrantScore(scoredResponses, 'RA');
  const seekingScore = calculateQuadrantScore(scoredResponses, 'BS');
  const sensitivityScore = calculateQuadrantScore(scoredResponses, 'SS');
  const avoidingScore = calculateQuadrantScore(scoredResponses, 'ES');

  return {
    sectionScores: {
      auditoryProcessing: auditoryProcessingScore,
      visualProcessing: visualProcessingScore,
      // ... outras seções
    },
    quadrantScores: {
      registration: registrationScore,
      seeking: seekingScore,
      sensitivity: sensitivityScore,
      avoiding: avoidingScore
    }
  };
};

// Funções auxiliares
const mapResponseToValue = (response: string): number => {
  switch (response.toLowerCase()) {
    case 'always': return ResponseValue.ALWAYS;
    case 'frequently': return ResponseValue.FREQUENTLY;
    case 'occasionally': return ResponseValue.OCCASIONALLY;
    case 'rarely': return ResponseValue.RARELY;
    case 'never': return ResponseValue.NEVER;
    default: throw new Error(`Invalid response: ${response}`);
  }
};

const calculateSectionScore = (responses: Array<{ itemId: number, value: number }>, section: string) => {
  // Implementar lógica para calcular pontuação da seção
  // Buscar itens da seção no banco de dados e somar pontuações
};

const calculateQuadrantScore = (responses: Array<{ itemId: number, value: number }>, quadrant: string) => {
  // Implementar lógica para calcular pontuação do quadrante
  // Buscar itens do quadrante no banco de dados e somar pontuações
};
```

## 4. Segurança e Autenticação

### 4.1 Implementação de Autenticação
1. Utilizar JWT (JSON Web Tokens) para autenticação
2. Implementar endpoints para registro e login
3. Criar middleware de autenticação para proteger rotas

### 4.2 Segurança
1. Implementar validação de entrada usando bibliotecas como Joi ou Zod
2. Configurar CORS para permitir apenas origens confiáveis
3. Implementar rate limiting para prevenir ataques de força bruta
4. Usar Helmet para configurar cabeçalhos HTTP de segurança
5. Sanitizar dados de entrada para prevenir injeção SQL e XSS

## 5. Implantação no Render

### 5.1 Configuração do Serviço Web
1. Criar um novo serviço Web no Render
2. Conectar ao repositório Git
3. Configurar variáveis de ambiente:
   - `DATABASE_URL` - URL de conexão com o PostgreSQL
   - `JWT_SECRET` - Chave secreta para JWT
   - `NODE_ENV` - Ambiente (production)
   - `PORT` - Porta do servidor (ou usar a padrão do Render)
4. Configurar build command:
   ```
   npm install && npx prisma generate && npm run build
   ```
5. Configurar start command:
   ```
   npm start
   ```

### 5.2 CI/CD
1. Configurar integração contínua com GitHub Actions ou similar
2. Implementar testes automatizados que rodam antes do deploy
3. Configurar o Render para deploy automático na branch main

## 6. Integração com o Frontend

### 6.1 Configuração CORS
Configurar CORS no backend para permitir requisições do frontend hospedado:
```typescript
app.use(cors({
  origin: process.env.FRONTEND_URL || 'https://sensory-profile-front.onrender.com',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
```

### 6.2 Atualização do Frontend
1. Criar serviços no frontend para comunicação com a API
2. Implementar interceptors para adicionar tokens de autenticação
3. Atualizar o formulário para enviar dados para a API
4. Implementar visualização de relatórios baseados nos dados da API

## 7. Monitoramento e Manutenção

### 7.1 Logging
1. Implementar logging com Winston ou similar
2. Configurar níveis de log apropriados para diferentes ambientes

### 7.2 Monitoramento
1. Configurar alertas no Render para notificar sobre problemas
2. Implementar health checks para verificar o status do serviço
3. Monitorar uso de recursos e escalabilidade

## 8. Cronograma de Implementação

| Fase | Descrição | Tempo Estimado |
|------|-----------|----------------|
| 1 | Configuração inicial do projeto e ambiente | 1 dia |
| 2 | Implementação do banco de dados e Prisma | 2 dias |
| 3 | Desenvolvimento dos endpoints básicos da API | 3 dias |
| 4 | Implementação do serviço de cálculo de pontuações | 2 dias |
| 5 | Implementação de autenticação e segurança | 2 dias |
| 6 | Testes e correções | 3 dias |
| 7 | Implantação no Render | 1 dia |
| 8 | Integração com o frontend | 2 dias |
| 9 | Testes finais e ajustes | 2 dias |
| **Total** | | **18 dias** |

## 9. Próximos Passos e Melhorias Futuras

1. Implementar exportação de relatórios em PDF
2. Adicionar suporte a múltiplos idiomas
3. Implementar comparação entre avaliações para acompanhamento longitudinal
4. Desenvolver dashboard para visualização de dados agregados
5. Implementar sistema de notificações para lembretes de reavaliação

## 10. Recursos e Referências

1. [Documentação do Render](https://render.com/docs)
2. [Documentação do Prisma](https://www.prisma.io/docs/)
3. [Documentação do Express.js](https://expressjs.com/)
4. [Guia de Segurança OWASP](https://owasp.org/www-project-top-ten/)
5. [Documentação do JWT](https://jwt.io/introduction/)
