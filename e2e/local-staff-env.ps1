# No source-code password or email-to-role fallback exists. Configure legitimately
# provisioned local accounts, or use p1-browser.cjs for fully isolated setup.
$browserRequired=@('W8LAB_BROWSER_TECHNICIAN','W8LAB_BROWSER_REVIEWER','W8LAB_BROWSER_ADMINISTRATOR','W8LAB_BROWSER_OTHER_TECHNICIAN','W8LAB_BROWSER_PASSWORD')
foreach($browserVariable in $browserRequired) {
  if(-not [Environment]::GetEnvironmentVariable($browserVariable)) { throw "Missing $browserVariable. Use provisioned accounts or node e2e/p1-browser.cjs." }
}
Remove-Variable browserRequired,browserVariable
