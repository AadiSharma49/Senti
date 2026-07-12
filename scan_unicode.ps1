$ErrorActionPreference='SilentlyContinue'
$files = Get-ChildItem -Path "e:\Senti\desktop\src" -Recurse -Include *.ts,*.tsx | Select-Object -ExpandProperty FullName
foreach ($file in $files) {
  $lines = Get-Content $file -Encoding UTF8
  $found = $false
  for ($i = 0; $i -lt $lines.Count; $i++) {
    $line = $lines[$i]
    if ($line -match "[^\x00-\x7F]") {
      if (-not $found) { Write-Host "FILE: $file"; $found = $true }
      $col = 0
      for ($c = 0; $c -lt $line.Length; $c++) {
        if ([int]$line[$c] -gt 127) { $col = $c + 1; break }
      }
      Write-Host "  LINE $($i+1) COL $col : $($line.TrimStart().Substring(0, [Math]::Min(80, $line.TrimStart().Length)))..."
    }
  }
}