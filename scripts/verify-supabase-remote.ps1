[CmdletBinding()]
param(
  [string]$SupabaseUrl = $env:EXPO_PUBLIC_SUPABASE_URL,
  [string]$PublishableKey = $env:EXPO_PUBLIC_SUPABASE_ANON_KEY
)

$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$envFilePath = Join-Path $projectRoot '.env.local'
if (Test-Path -LiteralPath $envFilePath) {
  foreach ($envLine in Get-Content -LiteralPath $envFilePath) {
    if ($envLine -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$') {
      $envName = $Matches[1]
      $envValue = $Matches[2].Trim()
      if ($envValue.Length -ge 2 -and (($envValue.StartsWith('"') -and $envValue.EndsWith('"')) -or ($envValue.StartsWith("'") -and $envValue.EndsWith("'")))) {
        $envValue = $envValue.Substring(1, $envValue.Length - 2)
      }
      if ($envName -eq 'EXPO_PUBLIC_SUPABASE_URL' -and [string]::IsNullOrWhiteSpace($SupabaseUrl)) {
        $SupabaseUrl = $envValue
      }
      if ($envName -eq 'EXPO_PUBLIC_SUPABASE_ANON_KEY' -and [string]::IsNullOrWhiteSpace($PublishableKey)) {
        $PublishableKey = $envValue
      }
    }
  }
}

if ([string]::IsNullOrWhiteSpace($SupabaseUrl)) {
  throw 'EXPO_PUBLIC_SUPABASE_URL não está configurada.'
}

if ([string]::IsNullOrWhiteSpace($PublishableKey)) {
  throw 'EXPO_PUBLIC_SUPABASE_ANON_KEY não está configurada.'
}

$headers = @{
  apikey = $PublishableKey
  Authorization = "Bearer $PublishableKey"
}

function Test-RestResource {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Resource
  )

  $uri = "$($SupabaseUrl.TrimEnd('/'))/rest/v1/$Resource`?select=*&limit=1"

  try {
    Invoke-RestMethod -Uri $uri -Headers $headers -Method Get | Out-Null
    Write-Host "OK: public.$Resource"
  } catch {
    $responseBody = $_.ErrorDetails.Message
    if ([string]::IsNullOrWhiteSpace($responseBody)) {
      $responseBody = $_.Exception.Message
    }

    if ($responseBody -match '"code"\s*:\s*"42501"') {
      Write-Host "AUTH REQUIRED: public.$Resource (schema encontrado; sessão autenticada necessária por RLS)"
      return
    }

    throw "Falha ao consultar public.$Resource. O schema remoto pode não estar aplicado. $responseBody"
  }
}

foreach ($resource in @('inventories', 'products', 'stock_balances', 'stock_movements')) {
  Test-RestResource -Resource $resource
}

Write-Host 'Verificação do schema Supabase concluída.'
