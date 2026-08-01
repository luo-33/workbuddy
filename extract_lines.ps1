$lines = Get-Content 'c:\Users\86158\WorkBuddy\2026-07-27-18-33-29\index.html'
for($i=10800; $i -le 10855; $i++){
  '{0}: {1}' -f ($i+1), $lines[$i]
}
