[CmdletBinding()]
param(
  [ValidateSet('preview', 'production', 'development')]
  [string]$Profile = 'preview'
)

$ErrorActionPreference = 'Stop'

Write-Host 'Validando autenticação EAS...'
npx eas-cli@latest whoami --non-interactive
if ($LASTEXITCODE -ne 0) {
  throw 'EAS não está autenticado. Execute npx eas-cli@latest login ou configure EXPO_TOKEN.'
}

Write-Host "Iniciando build Android com o perfil '$Profile'..."
npx eas-cli@latest build --platform android --profile $Profile --non-interactive
if ($LASTEXITCODE -ne 0) {
  throw "O build Android com o perfil '$Profile' falhou."
}

Write-Host 'Build Android concluído.'
