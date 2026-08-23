import rateLimit from 'express-rate-limit';
import { Request } from 'express';

/**
 * Ambientes em que é aceitável afrouxar as proteções. Explícito de propósito:
 * antes, tudo que **não fosse** `production` desligava rate limiting e CSP, o
 * que significa que um deploy que esquecesse `NODE_ENV` subia saudável, passava
 * no health check e ficava sem nenhuma das duas — sem nada nos logs dizendo isso.
 * Invertido, o padrão de um valor ausente ou digitado errado é o seguro.
 */
export function isRelaxedEnvironment(): boolean {
  return process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';
}

/**
 * Limitador por usuário autenticado (caindo para o IP), que é o recorte certo
 * para operações caras: o limite global por IP não protege de um único usuário
 * legítimo, e num NAT corporativo pune vários usuários por causa de um.
 *
 * Em memória, portanto por instância — com N dynos o limite efetivo é N × max.
 * É o mesmo compromisso que os limitadores de IA já assumem.
 */
export function perUserLimiter(options: { windowMs: number; max: number; message: string }) {
  return rateLimit({
    windowMs: options.windowMs,
    max: options.max,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req: Request) => req.userId ?? req.ip ?? 'unknown',
    skip: () => isRelaxedEnvironment(),
    message: {
      success: false,
      error: {
        type: 'RateLimitError',
        message: options.message,
        statusCode: 429,
      },
    },
  });
}

const HOUR = 60 * 60 * 1000;

/**
 * Cada chamada inicia um job cobrado no AWS Transcribe. Sem limite, um único
 * usuário autenticado podia disparar tantos quantos o teto global de IP
 * permitisse (600/15min).
 */
export const transcriptionLimiter = perUserLimiter({
  windowMs: HOUR,
  max: 30,
  message: 'Muitas transcrições. Tente novamente em uma hora.',
});

/**
 * Uma exportação varre a conta inteira — dezenas de consultas por criança —
 * e escreve um JSON completo no S3. É direito do titular (LGPD Art. 18), então
 * o limite é generoso; o que ele impede é o uso repetido como negação de
 * serviço contra o pool de conexões, que é de 10.
 */
export const accountExportLimiter = perUserLimiter({
  windowMs: HOUR,
  max: 5,
  message: 'Muitas exportações. Tente novamente em uma hora.',
});

/**
 * Cada URL pré-assinada permite um PUT de tamanho não verificado no bucket.
 * O limite é alto o bastante para um envio em lote de fotos e baixo o
 * bastante para não virar armazenamento gratuito de terceiros.
 */
export const uploadUrlLimiter = perUserLimiter({
  windowMs: HOUR,
  max: 120,
  message: 'Muitos envios. Tente novamente em uma hora.',
});
