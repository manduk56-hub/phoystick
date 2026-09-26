# 자동 배포

`master` 푸시 또는 GitHub Actions의 **Deploy production → Run workflow**로 배포한다.
GitHub가 저장소의 Git bundle을 전송하고 서버가 `git fetch`로 해당 커밋을 받아
설치·타입 검사·테스트·빌드를 실행한다. 새 릴리스로 전환한 뒤 두 서비스를
재시작하고 웹과 연결 API를 검사한다. 전환 후 실패하면 이전 릴리스로 복구한다.
서버에 GitHub 개인 토큰이나 저장소 개인키를 저장할 필요가 없다.

## 최초 연결

저장소 **Settings → Secrets and variables → Actions → New repository secret**에 등록한다.

| Secret | 값 |
| --- | --- |
| `DEPLOY_HOST` | `115.68.208.145` |
| `DEPLOY_USER` | 실제 SSH 로그인 계정 |
| `DEPLOY_SSH_KEY` | 해당 계정에 접속 가능한 배포 전용 SSH 개인키 전체 |
| `DEPLOY_KNOWN_HOSTS` | 서버 SSH 호스트 키를 확인한 뒤 얻은 known_hosts 항목 |

개인키와 비밀번호는 소스·채팅·문서에 넣지 않는다. 개인키의 공개키를 서버 계정의
`~/.ssh/authorized_keys`에 등록해야 한다. SSH는 기본 포트 22를 사용한다.
호스트 키는 서버 콘솔의 키 지문과 비교한 후 등록한다.

## 서버 요건

- Linux, Node.js 22.13 이상, npm, git, curl, flock, tar, bash.
- 배포 계정이 `/opt/motion-games`에 쓰기 가능.
- `motion-games.service`, `motion-games-api.service`가 기존 설정으로 설치되어 있어야 함.
- `/opt/motion-games/current`는 기존 정상 릴리스를 가리키는 심볼릭 링크여야 함.
- root 계정 또는 두 서비스의 stop/restart/cat/is-active에 대한 비밀번호 없는 sudo 권한.
- 런타임 환경 파일은 `/opt/motion-games/shared/`에 보관. 기존 설치에 환경 파일이
  있으면 최초 배포 전에 이곳으로 복사한다. DB는 최초 전환 때 기존 Wrangler 상태에서 보존한다.
- 기존 서비스가 다른 `--persist-to` 경로를 사용하면 배포 전에 상태 경로를 맞춰야 함.

GitHub의 Secrets 등록과 서버 권한 설정이 끝난 뒤 Actions에서 수동 실행한다.
서비스 설정 파일 변경은 자동 설치하지 않으므로 필요할 때 서버에서 따로 적용한다.
현재 DB 스키마 변경에 대한 자동 마이그레이션은 실행하지 않는다.
