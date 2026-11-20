# ESTCODE 2.0 — desenho do produto

## Objetivo

Evoluir o ESTCODE para facilitar o trabalho diário com conta, catálogo e estoque, exibindo preços diretamente na pesquisa de produtos e permitindo consultar NF-e destinadas ao CNPJ da empresa. A nota importada só altera o saldo após revisão e confirmação por usuário autorizado.

## Estado atual relevante

- O app usa Expo SDK 58, Expo Router, Supabase e um estoque compartilhado.
- O perfil mostra o UUID no campo visualmente destinado ao e-mail; não há edição de nome na tela.
- Produtos já armazenam custo, preço de venda, estoque mínimo e estoque-alvo. A lista de pesquisa não mostra os preços.
- Configurações do estoque cobrem saldo negativo e autorização para ajustes por operadores.
- Entradas atuais são registradas por RPC transacional; não há modelo para documentos fiscais.
- Fornecedores já possuem campo `document`, ainda sem vínculo automático com uma rotina fiscal.

## Abordagens consideradas

1. **Integração direta com a distribuição oficial de NF-e (escolhida):** consultas e processamento do certificado ficam no servidor. Evita dependência de fornecedor fiscal, com maior esforço de implementação e manutenção do protocolo.
2. **Provedor fiscal:** simplifica a comunicação fiscal, com custo recorrente e dependência externa.

## Proposta escolhida

### Perfil

- Mostrar nome, e-mail real da sessão e papel com hierarquia clara.
- Permitir editar nome; oferecer caminho para recuperação/alteração de senha e manter ações administrativas existentes.
- Não permitir alterar papel ou estado da conta na edição pessoal.

### Produtos e pesquisa

- Mostrar preço de venda e custo, identificados com clareza, em cada resultado de busca; respeitar permissões antes de exibir custo para perfis não administrativos.
- Separar consulta/apresentação do produto da edição. A rota atual `/products/[id]` abre diretamente `ProductFormScreen`; na 2.0 ela deve abrir uma ficha de consulta, com ação explícita “Editar” disponível somente a quem pode gerenciar o catálogo.
- Permitir associar uma imagem ao produto, escolhida da galeria ou capturada pela câmera, com envio ao Supabase Storage e referência persistida no produto. Exibir imagem na ficha e miniatura na lista; tratar ausência/falha de imagem com estado visual neutro.
- Manter pesquisa por nome, SKU e código de barras; melhorar leitura visual de saldo, unidade e limites de reposição.
- Revisar validações e edição sem alterar histórico nem remover produtos já movimentados.

### Configurações de estoque

- Preservar opções existentes e acrescentar configurações explícitas para comportamento de entradas, alertas e reposição, somente quando houver regra definida e persistida no banco.
- Apresentar descrições claras e exigir confirmação em opções que possam permitir saldo negativo.
- Não presumir estoque-alvo global: produtos já guardam seu próprio mínimo e alvo.

### Consulta automática de NF-e

- Criar configuração administrativa da empresa destinatária (CNPJ e dados de integração) e rotina de consulta iniciada manualmente por administrador na primeira entrega.
- Comunicar com o serviço oficial por um backend Node separado, protegido por autenticação Supabase. Certificado A1 e senha ficam como segredo do servidor, nunca em AsyncStorage, SQLite, código do app, tabela legível pelo cliente ou logs.
- Armazenar NSU e documentos com unicidade/idempotência; processar resumos, XMLs e eventos sem criar entradas em duplicidade.
- Exibir lista de notas, emitente, data, valor, situação fiscal e itens disponíveis. Lidar com notas canceladas e documentos ainda resumidos.
- Não emitir manifestação fiscal automaticamente na primeira versão. Informar quando a nota exigir manifestação para liberar o XML e encaminhar o usuário para o procedimento configurado.
- Permitir relacionar itens da nota a produtos existentes ou criar cadastro durante a revisão. Divergências de unidade, quantidade e preço exigem confirmação.
- A confirmação final gera movimentos de entrada auditáveis via RPC transacional, associando documento/linha e chave de idempotência. Nota revisada/cancelada não pode ser aplicada novamente sem fluxo explícito de correção.
- Limitar chamadas e manter checkpoint NSU, respeitando respostas, intervalos e regras atuais do serviço da NF-e.

### Segurança, dados e implantação

- Adicionar migrations para configuração da empresa, documentos fiscais, linhas, checkpoints e referências de origem da movimentação; RLS para leitura autorizada e operações administrativas mediadas por função segura.
- Certificado é segredo operacional de alto impacto. A decisão de produto é mantê-lo em gestão de secrets do backend ou cofre compatível; avaliar o mecanismo disponível no projeto Supabase antes da implementação. Não salvar certificado em coluna comum.
- A distribuição oficial exige mTLS. A documentação do Deno oferece suporte cliente a cert/key em `Deno.createHttpClient`, mas evidência recente do runtime Supabase mostra incompatibilidades com essa API/flags e não há prova local com o certificado. Para não depender de uma capacidade instável, a proposta técnica atual fixa um pequeno serviço Node dedicado, com `https.Agent`/PFX e segredos do host, sem credencial privilegiada do Supabase. O serviço valida JWT Supabase e perfil admin ativo antes de consultar.
- O CNPJ e certificado da empresa ainda precisam ser cadastrados/configurados pelo administrador em ambiente seguro. Não solicitar nem colocar o arquivo ou senha no chat/repositório.

## Fluxo da nota

1. Administrador aciona “Consultar notas”.
2. Servidor consulta a partir do NSU salvo e persiste documentos de forma idempotente.
3. App apresenta notas e estados: resumo aguardando manifestação, disponível para revisão, aplicada, cancelada ou erro de consulta.
4. Usuário revisa emitente, itens, quantidades, custos e associação ao catálogo.
5. Administrador confirma; backend valida documento/linhas e registra todas as entradas e auditoria sem duplicidade.

## Fora do escopo desta entrega

- Emissão de NF-e, escrituração contábil ou cálculo tributário.
- Manifestação automática de destinatário.
- Busca de CT-e/NFC-e ou suporte multiempresa/multiestoque.
- Garantia de atualização em tempo real: a primeira versão usa consulta manual respeitando limites oficiais.

## Fases propostas

1. Ajustes visuais e de dados de perfil/produtos, inclusive preços na busca.
2. Definição e persistência das novas preferências de estoque.
3. Spike servidor: validar certificados, SOAP, comunicação fiscal, limites do runtime e armazenamento seguro de segredo. Usar backend Node independente para mTLS.
4. Modelo de documentos, consulta incremental por NSU, idempotência e estados.
5. Interface de revisão, vínculo de itens e lançamento transacional/auditável.
6. Testes de permissões, segurança, duplicidade, erros fiscais e regressão; documentação e build Android.

## Condições para considerar concluído

- Nenhum preço de venda/custo é inventado; valores ausentes aparecem como não informado.
- Abrir um produto em modo de consulta nunca habilita campos editáveis; alterações exigem a ação de edição e permissão de catálogo.
- Imagem ausente, upload interrompido ou URL indisponível não impede consulta nem edição do cadastro.
- Custo só é mostrado a perfis autorizados conforme regra aprovada.
- Repetir uma consulta ou confirmação não duplica documento nem saldo.
- Nenhum documento altera estoque sem revisão e confirmação explícita.
- O certificado não aparece no cliente, banco exposto, logs, git ou artefatos.
- Erros, NSU sem novos documentos, resumo que aguarda manifestação e cancelamento têm estados compreensíveis.
- Migration, RPCs, RLS, serviços, telas e testes são entregues e documentados.

## Pontos para confirmar antes do plano

- A NF-e deve ficar em revisão até um administrador confirmar cada documento; sugestão padrão adotada.
- Mostrar custo unitário apenas ao administrador; operadores e consultores veem preço de venda. Sugestão padrão adotada.
- As preferências adicionais de estoque devem ser definidas em conjunto; não criar opções sem significado operacional.
- Evidência do runtime não comprova mTLS seguro e estável em Supabase Edge; backend Node protegido separado é a proposta adotada, sujeito a prova de conexão no ambiente de homologação.
