# Dot-source from any location. Loads only the existing local demo setup and
# never writes credentials to output, files or command-line arguments.
$browserProjectRoot = Split-Path -Parent $PSScriptRoot
$browserAuthSource = Get-Content -LiteralPath (Join-Path $browserProjectRoot 'backend/src/routes/auth.routes.ts') -Raw
$browserPasswordMatch = [regex]::Match($browserAuthSource, "if\s*\(password !== '([^']+)'\)")
if (-not $browserPasswordMatch.Success) { throw 'Development staff login changed; configure W8LAB_BROWSER_* variables explicitly.' }
$env:W8LAB_BROWSER_PASSWORD = $browserPasswordMatch.Groups[1].Value
$browserGuide = Get-Content -LiteralPath (Join-Path $browserProjectRoot 'docs/LABORATORY_REVIEW_WORKFLOW.md') -Raw
$browserAccounts = [regex]::Matches($browserGuide, '\| (Technician|Reviewer|Administrator|Different technician) \| `([^`]+)`')
if ($browserAccounts.Count -ne 4) { throw 'Documented development account setup is unavailable.' }
foreach ($browserAccount in $browserAccounts) {
  switch ($browserAccount.Groups[1].Value) {
    'Technician' { $env:W8LAB_BROWSER_TECHNICIAN=$browserAccount.Groups[2].Value }
    'Reviewer' { $env:W8LAB_BROWSER_REVIEWER=$browserAccount.Groups[2].Value }
    'Administrator' { $env:W8LAB_BROWSER_ADMINISTRATOR=$browserAccount.Groups[2].Value }
    'Different technician' { $env:W8LAB_BROWSER_OTHER_TECHNICIAN=$browserAccount.Groups[2].Value }
  }
}
Remove-Variable browserAuthSource,browserPasswordMatch,browserGuide,browserAccounts,browserAccount,browserProjectRoot
