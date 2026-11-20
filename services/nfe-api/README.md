# API de distribuição de NF-e

Serviço Node separado do app Expo. Executa a consulta de distribuição oficial por mTLS e grava os documentos usando a sessão do administrador no Supabase. Nenhuma chave `service_role` é usada.

## Executar

Na raiz do repositório:

```powershell
npm run nfe-api
```

Configure no host:

| Variável | Uso |
| --- | --- |
| `PORT` | Porta HTTP recebida pelo proxy TLS do host; padrão `8787`. |
| `SUPABASE_URL` | URL do projeto Supabase. |
| `SUPABASE_ANON_KEY` | Chave pública/publishable, usada junto ao JWT recebido. |
| `NFE_CERTIFICATE_PFX_BASE64` | PFX A1 em Base64, exclusivamente no secret manager do host. |
| `NFE_CERTIFICATE_PASSWORD` | Senha do PFX, exclusivamente no secret manager do host. |
| `NFE_ENVIRONMENT_CODE` | `1` produção ou `2` homologação; padrão `1`. |
| `NFE_DISTRIBUTION_ENDPOINT` | Endpoint SOAP correspondente ao ambiente/certificado; padrão produção nacional. |
| `ALLOWED_ORIGINS` | Origens web separadas por vírgula. Chamadas nativas continuam exigindo JWT. |

O app usa `EXPO_PUBLIC_NFE_API_URL` para apontar para o host. HTTPS deve terminar no proxy/host. Nunca passe o certificado pelo app, por uma rota comum de upload, por issue/chat, ou por tabela Supabase.

## Fluxo

1. O serviço valida o JWT no Supabase e consulta o perfil ativo; exige `admin`.
2. A RPC `acquire_fiscal_sync_lease` serializa consultas e respeita a janela persistida.
3. A API faz uma única consulta SOAP por NSU com mTLS, decodifica os `docZip` e rejeita DTD/entidades ou XML acima do limite.
4. XML privado, metadados e itens são persistidos com RLS; a consulta não cria movimentações.
5. A RPC de aplicação só aceita NF-e completa conferida, mapeamentos completos, unidade correspondente e quantidade representável no estoque. A transação cria todas as entradas ou nenhuma.

Não há manifestação automática do destinatário. Documentos resumidos aguardam o fluxo fiscal autorizado para liberação do XML completo. A SEFAZ pode limitar novas consultas por uma hora, inclusive após consumo indevido (`cStat 656`).

## Limitações ainda abertas

- O serviço compila e seus parsers têm testes unitários, mas não foi feito handshake mTLS nem chamada de homologação/produção. O certificado A1 e a senha precisam ser provisionados no host diretamente pelo proprietário.
- O teste ainda não confirmou o endpoint homologação correto para a UF/ambiente; configure `NFE_DISTRIBUTION_ENDPOINT` ao validar com um certificado de homologação.
- O intervalo da SEFAZ e o bloqueio são por empresa compartilhada, não há scheduler automático; a consulta é iniciada pelo administrador no app.
- O XML completo só estará disponível depois dos eventos fiscais exigidos. O app não envia manifestação.
