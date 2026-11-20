# Spike: runtime e mTLS para distribuição de NF-e

## Resultado

**Decisão de implementação:** separar a conexão fiscal em um serviço Node protegido. O app chama esse serviço com o JWT da sessão Supabase; o serviço valida usuário e papel admin ativo, usa o e-CNPJ A1 como segredo de host e grava dados no Supabase com credenciais limitadas ao JWT do usuário. Não usar `service_role`.

## Evidências consultadas

- A documentação do Deno descreve `Deno.createHttpClient({ cert, key })` para mTLS; os valores precisam ser PEM. Fonte: https://docs.deno.com/api/deno/fetch/
- As Supabase Edge Function hosted têm limites de CPU por requisição e duração; secrets de função têm limite de tamanho. Fonte: https://supabase.com/docs/guides/functions/limits e https://supabase.com/docs/guides/functions/secrets
- Há relatos recentes de incompatibilidade entre o runtime Supabase Edge hospedado e a API/flag de HTTP customizado necessária para mTLS. Isso é evidência comunitária, não garantia oficial: https://github.com/orgs/supabase/discussions/48894 e https://github.com/orgs/supabase/discussions/50534
- O portal oficial da NF-e publica o endpoint de distribuição nacional e a NT 2014.002 descreve distribuição por NSU, documentos resumidos e liberação condicionada à manifestação. Fontes: https://www.nfe.fazenda.gov.br/PORTAl/webServices.aspx?AspxAutoDetectCookieSupport=1&tipoConteudo=OUC%2FYVNWZfo%3D e https://www.nfe.fazenda.gov.br/Portal/exibirArquivo.aspx?AspxAutoDetectCookieSupport=1&conteudo=155Wx5%2FJB5A%3D

## Limites desta prova

- O certificado produtivo não foi recebido nem carregado em nenhum ambiente. Nenhuma chamada real ou de homologação foi executada.
- A API Deno documentada não prova que Supabase Edge hosted permita inicializar esse cliente mTLS. Não assumimos capacidade sem execução verificável no ambiente.
- Node `https.Agent` suporta PKCS#12/PFX e passphrase, mas o serviço ainda precisa de um teste de handshake e resposta SOAP com certificado autorizado antes de liberar consulta produtiva.

## Requisitos do serviço Node

- Guardar PFX e senha no secret manager/secret file do host, limitar acesso operacional e documentar rotação/expiração.
- Nunca retornar, registrar ou persistir segredo/certificado; sanitizar erros e não registrar XML completo.
- Validar Bearer JWT via Supabase Auth e consultar `profiles` com o mesmo JWT; exigir `active=true` e `role=admin` em toda chamada.
- Usar o publishable key somente para criar cliente Supabase com o JWT do usuário; nenhuma chave service-role no serviço.
- Limitar tamanho de payload, concorrência e frequência por usuário/empresa; aceitar só ação de consulta e esquemas conhecidos.
- Consultas e inserções no banco devem ser idempotentes por NSU e chave de acesso; nenhuma requisição de sincronização pode alterar saldo.

## Próxima prova necessária

Depois de criado o serviço e antes de habilitar produção, provisionar o certificado diretamente no host escolhido, testar mTLS/SOAP em homologação quando disponível, validar a resposta de distribuição e remover o material de teste com rotação/limpeza documentada. A senha/certificado não devem ser enviados por chat nem adicionados ao Git.
