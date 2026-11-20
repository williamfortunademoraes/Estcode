[CmdletBinding()]
param(
  [string]$ProjectRef = 'bczcqcqokfkbajrnfpxl'
)

$ErrorActionPreference = 'Stop'

Write-Host "Vinculando o projeto Supabase $ProjectRef..."
npx supabase@latest link --project-ref $ProjectRef
if ($LASTEXITCODE -ne 0) {
  throw 'Não foi possível vincular o projeto Supabase.'
}

Write-Host 'Aplicando migrations versionadas...'
npx supabase@latest db push --remote --yes
if ($LASTEXITCODE -ne 0) {
  throw 'As migrations não foram aplicadas no Supabase remoto.'
}

Write-Host 'Publicando a Edge Function administrativa...'
npx supabase@latest functions deploy admin-users --use-api --yes
if ($LASTEXITCODE -ne 0) {
  throw 'A Edge Function administrativa não foi publicada no Supabase remoto.'
}

Write-Host ''
Write-Host 'Deploy concluído. A Edge Function usa o secret gerenciado SUPABASE_SERVICE_ROLE_KEY no ambiente Supabase.'
Write-Host 'A chave privilegiada não deve ser adicionada ao .env do Expo.'
