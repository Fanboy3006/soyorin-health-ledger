$token = "sbp_v0_51cdf27e13a11758dac27260a10ec5a35ebbdb32"
$projectId = "jddxpgcbhlvayxioneqs"
$functionName = "ai-vision-recognize"

# Read the function code
$code = Get-Content -Path "f:\Project_Soyorin\V0\supabase\functions\ai-vision-recognize\index.ts" -Raw

# Step 1: Create the function via Management API
Write-Output "Step 1: Creating function..."
$createPayload = @{
    name = $functionName
    slug = $functionName
    verify_jwt = $false
} | ConvertTo-Json

try {
    $createResult = Invoke-WebRequest -Uri "https://api.supabase.com/v1/projects/$projectId/functions" -Method POST -Headers @{
        "Authorization"="Bearer $token"
        "Content-Type"="application/json"
    } -Body $createPayload -UseBasicParsing
    Write-Output "Create result: $($createResult.StatusCode) $($createResult.Content)"
} catch {
    Write-Output "Create error: $($_.Exception.Response.StatusCode.value__)"
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Output "Response body: $responseBody"
    }
}

# Step 2: Deploy the function code
Write-Output "`nStep 2: Deploying function code..."
$boundary = [System.Guid]::NewGuid().ToString()
$metadata = '{"name":"' + $functionName + '","slug":"' + $functionName + '","verify_jwt":false}'

# Build multipart body
$bodyLines = New-Object System.Collections.ArrayList
[void]$bodyLines.Add("--$boundary")
[void]$bodyLines.Add('Content-Disposition: form-data; name="metadata"')
[void]$bodyLines.Add('Content-Type: application/json')
[void]$bodyLines.Add("")
[void]$bodyLines.Add($metadata)
[void]$bodyLines.Add("--$boundary")
[void]$bodyLines.Add('Content-Disposition: form-data; name="file"; filename="index.ts"')
[void]$bodyLines.Add('Content-Type: application/octet-stream')
[void]$bodyLines.Add("")
[void]$bodyLines.Add($code)
[void]$bodyLines.Add("--$boundary--")
$body = $bodyLines -join "`r`n"

try {
    $deployResult = Invoke-WebRequest -Uri "https://api.supabase.com/v1/projects/$projectId/functions/$functionName" -Method PUT -Headers @{
        "Authorization"="Bearer $token"
        "Content-Type"="multipart/form-data; boundary=$boundary"
    } -Body $body -UseBasicParsing
    Write-Output "Deploy result: $($deployResult.StatusCode) $($deployResult.Content)"
} catch {
    Write-Output "Deploy error: $($_.Exception.Response.StatusCode.value__)"
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Output "Response body: $responseBody"
    }
}
