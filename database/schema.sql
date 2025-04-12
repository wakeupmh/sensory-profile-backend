-- Esquema de banco de dados para o Perfil Sensorial 2
-- Baseado na estrutura do formulário e componentes

-- Tabela para dados da criança
CREATE TABLE children (
    id UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    birth_date DATE NOT NULL,
    gender VARCHAR(50),
    national_identity varchar(50),
    user_id uuid,
    other_info TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabela para dados do examinador
CREATE TABLE examiners (
    id UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    profession VARCHAR(255) NOT NULL,
    contact VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabela para dados do cuidador
CREATE TABLE caregivers (
    id UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    relationship VARCHAR(100) NOT NULL,
    contact VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabela para armazenar avaliações completas
CREATE TABLE sensory_assessments (
    id UUID PRIMARY KEY,
    child_id UUID REFERENCES children(id) ON DELETE CASCADE,
    examiner_id UUID REFERENCES examiners(id) ON DELETE SET NULL,
    caregiver_id UUID REFERENCES caregivers(id) ON DELETE SET NULL,
    assessment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    auditory_processing_raw_score INTEGER,
    visual_processing_raw_score INTEGER,
    tactile_processing_raw_score INTEGER,
    movement_processing_raw_score INTEGER,
    body_position_processing_raw_score INTEGER,
    oral_sensitivity_processing_raw_score INTEGER,
    social_emotional_responses_raw_score INTEGER,
    attention_responses_raw_score INTEGER,
    user_id VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabela para armazenar comentários por seção
CREATE TABLE section_comments (
    id UUID PRIMARY KEY,
    assessment_id UUID REFERENCES sensory_assessments(id) ON DELETE CASCADE,
    section_name VARCHAR(100) NOT NULL,
    comments TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (assessment_id, section_name)
);

-- Tabela para definir os itens do questionário
CREATE TABLE sensory_items (
    id INTEGER PRIMARY KEY,
    quadrant VARCHAR(10),
    description TEXT NOT NULL,
    section VARCHAR(100) NOT NULL
);

-- Tabela para armazenar as respostas aos itens
CREATE TABLE sensory_responses (
    id UUID PRIMARY KEY,
    assessment_id UUID REFERENCES sensory_assessments(id) ON DELETE CASCADE,
    item_id INTEGER REFERENCES sensory_items(id) ON DELETE CASCADE,
    response VARCHAR(20) NOT NULL, -- 'always', 'frequently', 'occasionally', 'rarely', 'never'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (assessment_id, item_id)
);

-- Inserir os itens de processamento auditivo
INSERT INTO sensory_items (id, quadrant, description, section) VALUES
(1, 'RA', 'responde negativamente a sons altos ou inesperados (por exemplo, chora ou se esconde ao ouvir o barulho do aspirador de pó, latido de cachorro, secador de cabelo).', 'auditoryProcessing'),
(2, 'RA', 'segura as mãos sobre os ouvidos para se proteger de sons.', 'auditoryProcessing'),
(3, 'RA', 'tem dificuldade para concluir tarefas quando o rádio está ligado.', 'auditoryProcessing'),
(4, 'RA', 'fica distraído ou tem dificuldade para funcionar se houver muito barulho.', 'auditoryProcessing'),
(5, 'RA', 'não consegue trabalhar com barulho de fundo (por exemplo, ventilador, refrigerador).', 'auditoryProcessing'),
(6, 'BS', 'parece não ouvir o que você diz (por exemplo, parece não prestar atenção no que você diz, ou ignora você).', 'auditoryProcessing'),
(7, 'BS', 'não responde quando chamam seu nome, mas você sabe que a audição da criança está normal.', 'auditoryProcessing'),
(8, 'BS', 'gosta de barulhos estranhos/procura fazê-los.', 'auditoryProcessing');

-- Inserir os itens de processamento visual
INSERT INTO sensory_items (id, quadrant, description, section) VALUES
(9, 'RA', 'prefere brincar no escuro.', 'visualProcessing'),
(10, 'RA', 'expressa desconforto com ou evita luzes brilhantes (por exemplo, esconde-se da luz do sol através da janela do carro).', 'visualProcessing'),
(11, 'RA', 'feliz em estar no escuro.', 'visualProcessing'),
(12, 'RA', 'fica frustrada quando tenta encontrar objetos em fundos concorrentes (por exemplo, meias na gaveta de meias).', 'visualProcessing'),
(13, 'BS', 'olha cuidadosamente ou intensamente para objetos/pessoas (por exemplo, olha fixamente para objetos).', 'visualProcessing'),
(14, 'BS', 'tem dificuldade em encontrar objetos em fundos concorrentes (por exemplo, sapato em um quarto bagunçado, item favorito no mercado).', 'visualProcessing'),
(15, 'BS', 'fecha os olhos ou baixa a cabeça quando há luzes brilhantes.', 'visualProcessing'),
(16, 'BS', 'tem dificuldade em controlar os olhos durante atividades (por exemplo, controlar o movimento dos olhos durante a leitura ou copiando do quadro).', 'visualProcessing'),
(17, 'SS', 'gosta de olhar para objetos brilhantes que giram e se movem.', 'visualProcessing'),
(18, 'SS', 'gosta de olhar para objetos/itens que se movem rapidamente (por exemplo, fãs em movimento, brinquedos com peças em movimento, tela de TV).', 'visualProcessing'),
(19, 'SS', 'gosta de olhar para objetos visuais brilhantes.', 'visualProcessing');

-- Inserir os itens de processamento tátil
INSERT INTO sensory_items (id, quadrant, description, section) VALUES
(20, 'RA', 'fica angustiada quando tem o rosto lavado.', 'tactileProcessing'),
(21, 'RA', 'fica angustiada quando tem o cabelo, as unhas ou a cara lavados ou cortados.', 'tactileProcessing'),
(22, 'RA', 'evita certas gostos ou cheiros de comida que são tipicamente parte da dieta de uma criança.', 'tactileProcessing'),
(23, 'RA', 'come apenas alimentos com certos sabores.', 'tactileProcessing'),
(24, 'RA', 'limita-se a determinadas texturas de alimentos.', 'tactileProcessing'),
(25, 'RA', 'evita brincar com equipamentos de parquinho ou superfícies externas (por exemplo, grama, areia).', 'tactileProcessing'),
(26, 'RA', 'expressa angústia durante o cuidado com a higiene pessoal (por exemplo, corte de unhas, lavagem do rosto).', 'tactileProcessing'),
(27, 'RA', 'expressa preferência por certas texturas de roupas ou tecidos.', 'tactileProcessing'),
(28, 'RA', 'fica irritada com as costuras das meias ou com as etiquetas nas roupas.', 'tactileProcessing'),
(29, 'RA', 'expressa desconforto ao escovar os dentes.', 'tactileProcessing'),
(30, 'RA', 'é seletiva quanto aos utensílios a usar para comer.', 'tactileProcessing'),
(31, 'BS', 'não parece notar quando alguém toca seu braço ou costas (por exemplo, não se vira quando tocada levemente).', 'tactileProcessing'),
(32, 'BS', 'não parece notar quando o rosto ou as mãos estão sujos.', 'tactileProcessing'),
(33, 'BS', 'deixa roupas torcidas no corpo.', 'tactileProcessing'),
(34, 'SS', 'toca pessoas e objetos.', 'tactileProcessing'),
(35, 'SS', 'não mantém distância adequada das outras pessoas.', 'tactileProcessing'),
(36, 'SS', 'parece não notar quando as mãos ou o rosto estão sujos.', 'tactileProcessing'),
(37, 'SS', 'fica excitada durante tarefas de higiene.', 'tactileProcessing'),
(38, 'SS', 'entra em espaços pessoais.', 'tactileProcessing'),
(39, 'SS', 'toca pessoas e objetos ao ponto de irritar os outros.', 'tactileProcessing'),
(40, 'SS', 'parece ter necessidade de tocar certas brinquedos, superfícies ou texturas (por exemplo, quer sentir tudo).', 'tactileProcessing'),
(41, 'SS', 'não parece notar quando as roupas estão torcidas no corpo.', 'tactileProcessing'),
(42, 'SS', 'toca pessoas e objetos.', 'tactileProcessing');

-- Inserir os itens de processamento de movimento
INSERT INTO sensory_items (id, quadrant, description, section) VALUES
(43, 'RA', 'fica ansiosa ou angustiada quando os pés saem do chão.', 'movementProcessing'),
(44, 'RA', 'não gosta de atividades em que fica de cabeça para baixo (por exemplo, cambalhota, brincadeiras ásperas).', 'movementProcessing'),
(45, 'RA', 'evita brinquedos de parquinho ou movimentos (por exemplo, balanços, escorregadores, carrosséis).', 'movementProcessing'),
(46, 'RA', 'não gosta de andar de elevador ou escadas rolantes.', 'movementProcessing'),
(47, 'RA', 'tem medo de cair ou de altura.', 'movementProcessing'),
(48, 'RA', 'não gosta de atividades em que a cabeça está para baixo.', 'movementProcessing'),
(49, 'SS', 'procura todo tipo de movimento e isso interfere com as rotinas diárias (por exemplo, não consegue ficar parada).', 'movementProcessing'),
(50, 'SS', 'busca atividades de movimento intenso (por exemplo, girar, saltar, escalar).', 'movementProcessing'),
(51, 'SS', 'gira/rodopia mais que outras crianças.', 'movementProcessing'),
(52, 'SS', 'balança-se intencionalmente.', 'movementProcessing'),
(53, 'SS', 'gosta de cavalgar em brinquedos com movimento rápido ou giratório (por exemplo, carrossel).', 'movementProcessing');

-- Inserir os itens de processamento de posição do corpo
INSERT INTO sensory_items (id, quadrant, description, section) VALUES
(54, 'BS', 'parece hesitante em subir ou descer escadas ou rampas.', 'bodyPositionProcessing'),
(55, 'BS', 'tem medo de subir ou descer escadas.', 'bodyPositionProcessing'),
(56, 'BS', 'não percebe quando o corpo está em uma posição estranha.', 'bodyPositionProcessing'),
(57, 'BS', 'hesita em escalar ou descer equipamentos de playground ou bordas de calçada.', 'bodyPositionProcessing'),
(58, 'BS', 'parece insegura quando é empurrada ou puxada.', 'bodyPositionProcessing'),
(59, 'BS', 'frequentemente tropeça ou é desajeitada.', 'bodyPositionProcessing'),
(60, 'SS', 'toma riscos excessivos durante o brincar (por exemplo, sobe alto em árvores, pula de móveis).', 'bodyPositionProcessing'),
(61, 'SS', 'toma riscos que comprometem a segurança pessoal.', 'bodyPositionProcessing'),
(62, 'SS', 'não parece ter medo de cair quando está em alturas.', 'bodyPositionProcessing'),
(63, 'SS', 'pula de um equipamento para outro.', 'bodyPositionProcessing'),
(64, 'SS', 'parece gostar de cair.', 'bodyPositionProcessing');

-- Inserir os itens de processamento de sensibilidade oral
INSERT INTO sensory_items (id, quadrant, description, section) VALUES
(65, 'RA', 'fica angustiada com experiências de cuidados dentários.', 'oralSensitivityProcessing'),
(66, 'RA', 'tem preferências fortes por certos sabores.', 'oralSensitivityProcessing'),
(67, 'RA', 'tem preferências fortes por certas temperaturas de alimentos.', 'oralSensitivityProcessing'),
(68, 'RA', 'é seletiva quanto aos sabores que gosta.', 'oralSensitivityProcessing'),
(69, 'RA', 'recusa certas gostos que normalmente as crianças gostam.', 'oralSensitivityProcessing'),
(70, 'RA', 'prefere alguns sabores.', 'oralSensitivityProcessing'),
(71, 'RA', 'limita-se a certas texturas de alimentos.', 'oralSensitivityProcessing'),
(72, 'RA', 'é seletiva quanto às texturas de alimentos.', 'oralSensitivityProcessing'),
(73, 'SS', 'lambe objetos não comestíveis.', 'oralSensitivityProcessing'),
(74, 'SS', 'mastiga ou lambe brinquedos, roupas ou outros objetos não comestíveis.', 'oralSensitivityProcessing'),
(75, 'SS', 'morde objetos não comestíveis.', 'oralSensitivityProcessing'),
(76, 'SS', 'coloca objetos na boca (por exemplo, mãos, brinquedos, tubos).', 'oralSensitivityProcessing');

-- Inserir os itens de respostas socioemocionais
INSERT INTO sensory_items (id, quadrant, description, section) VALUES
(77, 'RA', 'parece ter medo em espaços abertos.', 'socialEmotionalResponses'),
(78, 'RA', 'parece não gostar de atividades sociais.', 'socialEmotionalResponses'),
(79, 'RA', 'precisa de mais proteção da vida do que outras crianças.', 'socialEmotionalResponses'),
(80, 'RA', 'expressa angústia durante cortes de cabelo, lavagem do rosto ou corte de unhas.', 'socialEmotionalResponses'),
(81, 'RA', 'tem medo de multidões ou reuniões em grupo.', 'socialEmotionalResponses'),
(82, 'BS', 'não interpreta as dicas faciais ou linguagem corporal.', 'socialEmotionalResponses'),
(83, 'BS', 'não olha para as pessoas quando fala com elas.', 'socialEmotionalResponses'),
(84, 'BS', 'não se dá conta quando alguém entra na sala.', 'socialEmotionalResponses'),
(85, 'BS', 'parece não notar quando as pessoas estão próximas.', 'socialEmotionalResponses'),
(86, 'BS', 'parece não se dar conta quando pessoas entram na sala.', 'socialEmotionalResponses');

-- Inserir os itens de respostas de atenção
INSERT INTO sensory_items (id, quadrant, description, section) VALUES
(87, 'RA', 'parece não notar quando as pessoas estão próximas.', 'attentionResponses'),
(88, 'RA', 'parece não notar quando as pessoas entram na sala.', 'attentionResponses'),
(89, 'BS', 'olha para longe das tarefas para notar todos os outros movimentos na sala.', 'attentionResponses'),
(90, 'BS', 'parece não ouvir quando é chamado pelo nome.', 'attentionResponses'),
(91, 'BS', 'tem dificuldade em prestar atenção.', 'attentionResponses'),
(92, 'BS', 'parece ausente.', 'attentionResponses');

-- Criar índices para melhorar a performance de consultas
CREATE INDEX idx_user_id_child_id on children(user_id);
CREATE INDEX idx_sensory_responses_assessment_id ON sensory_responses(assessment_id);
CREATE INDEX idx_sensory_responses_item_id ON sensory_responses(item_id);
CREATE INDEX idx_sensory_assessments_child_id ON sensory_assessments(child_id);
CREATE INDEX idx_section_comments_assessment_id ON section_comments(assessment_id);
CREATE INDEX idx_sensory_items_section ON sensory_items(section);

-- Função para atualizar o timestamp de updated_at
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers para atualizar o timestamp de updated_at
CREATE TRIGGER update_children_modtime
BEFORE UPDATE ON children
FOR EACH ROW EXECUTE PROCEDURE update_modified_column();

CREATE TRIGGER update_examiners_modtime
BEFORE UPDATE ON examiners
FOR EACH ROW EXECUTE PROCEDURE update_modified_column();

CREATE TRIGGER update_caregivers_modtime
BEFORE UPDATE ON caregivers
FOR EACH ROW EXECUTE PROCEDURE update_modified_column();

CREATE TRIGGER update_sensory_assessments_modtime
BEFORE UPDATE ON sensory_assessments
FOR EACH ROW EXECUTE PROCEDURE update_modified_column();

CREATE TRIGGER update_section_comments_modtime
BEFORE UPDATE ON section_comments
FOR EACH ROW EXECUTE PROCEDURE update_modified_column();

CREATE TRIGGER update_sensory_responses_modtime
BEFORE UPDATE ON sensory_responses
FOR EACH ROW EXECUTE PROCEDURE update_modified_column();
