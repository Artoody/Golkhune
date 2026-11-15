$ErrorActionPreference = "Stop"
$headers = @{
  "Content-Type" = "application/json"
  "Project-Access-Token" = "811f3c9f-5da4-4999-86ed-12fb2bcdcd2f"
  "User-Agent" = "railway-cli/5.2.0"
}
try {
  $r = Invoke-WebRequest -Uri "https://backboard.railway.app/graphql/v2" -Method Post -Headers $headers -InFile ".tmp-railway-query.json" -UseBasicParsing
  Write-Output "STATUS=$($r.StatusCode)"
  Write-Output $r.Content
} catch {
  Write-Output "ERROR=$($_.Exception.Message)"
  if ($_.Exception.Response) {
    $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
    Write-Output $reader.ReadToEnd()
  }
}
