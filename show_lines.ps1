$lines = Get-Content 'c:\Users\86158\WorkBuddy\2026-07-27-18-33-29\index.html'
$start = 10820
$end = 10860
for($i=$start; $i -le $end; $i++){
  '{0}: {1}' -f $i, $lines[$i-1]
}
