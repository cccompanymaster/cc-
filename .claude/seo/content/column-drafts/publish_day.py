# 하루 묶음 발행: 게이트 → 빌드 → 등록 → 이미 발행한 글 다시 빌드(새 글로 가는 링크 복구) → llms
# 사용: python3 publish_day.py --date 2026-10-24 [--checked]   (--checked: 묶음의 'before' 확인을 마쳤을 때)
import json, sys, os, subprocess, datetime
D = os.path.dirname(os.path.abspath(__file__)) + '/'; ROOT = D.split('/.claude/')[0] + '/'
argv = sys.argv[1:]
date = argv[argv.index('--date') + 1] if '--date' in argv else datetime.date.today().isoformat()
sched = json.load(open(D + 'schedule.json', encoding='utf-8'))
todo = [b for b in sched['batches'] if b['date'] <= date and not all(s in sched['published'] for s in b['slugs'])]
if not todo: sys.exit(f'{date}: 발행할 묶음 없음 (남은 묶음 {sum(1 for b in sched["batches"] if b["date"] > date)}개)')
b = todo[0]
if b.get('before') and '--checked' not in argv: sys.exit('발행 전 확인 필요: ' + b['before'])
slugs = [s for s in b['slugs'] if s not in sched['published']]
run = lambda *a: subprocess.run([sys.executable, *a], check=True, cwd=ROOT)
gate = subprocess.run([sys.executable, D + 'gate.py'], capture_output=True, text=True).stdout
bad = [l for l in gate.splitlines() if any(l.strip().startswith(s + ' ') for s in slugs) and '키워드 없음' not in l]
if bad: sys.exit('게이트 실패:\n' + '\n'.join(bad))
run(D + 'build_columns.py', '--date', date, *slugs)
run(D + 'register_columns.py', '--date', date, *slugs)
for s in slugs: sched['published'][s] = date
json.dump(sched, open(D + 'schedule.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
# 이미 발행한 새 글 + 재작성한 기존 칼럼을 다시 빌드 — 오늘 발행한 글로 가는 링크가 살아난다
again = [s for s in sched['published'] if s not in slugs] + list(sched.get('rewritten', {}))
if again: run(D + 'build_columns.py', *again)
run(ROOT + '.claude/seo/build_llms.py')
left = sum(1 for x in sched['batches'] for s in x['slugs'] if s not in sched['published'])
print(f'발행 {len(slugs)}편 ({b["date"]} 묶음) · 다시 빌드 {len(again)}편 · 남은 새 글 {left}편')
