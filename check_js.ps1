$content = Get-Content js_extract.js -Raw
$len = $content.Length
$stack = New-Object System.Collections.Stack
$inString = $false
$stringChar = ''
$inLineComment = $false
$inBlockComment = $false
$line = 1
$col = 0
$errors = @()

for($i = 0; $i -lt $len; $i++) {
    $c = $content[$i]
    $col++
    if($c -eq "`n") { $line++; $col = 0 }

    if($inLineComment) {
        if($c -eq "`n") { $inLineComment = $false }
        continue
    }
    if($inBlockComment) {
        if($c -eq '*' -and $i+1 -lt $len -and $content[$i+1] -eq '/') { $inBlockComment = $false; $i++ }
        continue
    }
    if($inString) {
        if($c -eq '\' -and $i+1 -lt $len) { $i++; $col++; continue }
        if($c -eq $stringChar) { $inString = $false }
        continue
    }

    # Not in string or comment
    if($c -eq '/' -and $i+1 -lt $len -and $content[$i+1] -eq '/') { $inLineComment = $true; $i++; continue }
    if($c -eq '/' -and $i+1 -lt $len -and $content[$i+1] -eq '*') { $inBlockComment = $true; $i++; continue }
    if($c -eq '"' -or $c -eq "'" -or $c -eq '`') { $inString = $true; $stringChar = $c; continue }

    if($c -eq '{' -or $c -eq '(' -or $c -eq '[') {
        $stack.Push(@{char=$c; line=$line; col=$col})
    }
    elseif($c -eq '}' -or $c -eq ')' -or $c -eq ']') {
        if($stack.Count -eq 0) {
            $errors += "Line $line Col $col: unmatched closing '$c'"
        } else {
            $top = $stack.Pop()
            $expected = switch($c) { '}' {'{'} ')' {'('} ']' {'['} }
            if($top.char -ne $expected) {
                $errors += "Line $line Col $col: mismatched '$c' (expected to close '$($top.char)' opened at line $($top.line))"
            }
        }
    }
}

while($stack.Count -gt 0) {
    $top = $stack.Pop()
    $errors += "Unclosed '$($top.char)' opened at line $($top.line) col $($top.col)"
}

if($errors.Count -eq 0) {
    Write-Output "JS brackets balanced OK"
} else {
    Write-Output "Found $($errors.Count) bracket errors:"
    $errors | ForEach-Object { Write-Output $_ }
}
