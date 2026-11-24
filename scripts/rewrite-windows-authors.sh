#!/bin/sh
set -e
export FILTER_BRANCH_SQUELCH_WARNING=1

git filter-branch -f \
  --env-filter '
    case "$GIT_AUTHOR_DATE" in
      *-0400)
        export GIT_AUTHOR_NAME="Surabhi Komanduri"
        export GIT_AUTHOR_EMAIL="269730084+surabhikom@users.noreply.github.com"
        export GIT_COMMITTER_NAME="Surabhi Komanduri"
        export GIT_COMMITTER_EMAIL="269730084+surabhikom@users.noreply.github.com"
        ;;
    esac
  ' \
  --msg-filter '
    msg="$(cat)"
    case "$GIT_AUTHOR_DATE" in
      *-0400)
        if ! printf "%s" "$msg" | grep -q "Co-authored-by: Ananya Pamal"; then
          printf "%s\n\nCo-authored-by: Ananya Pamal <niyapamal@gmail.com>\n" "$msg"
          exit 0
        fi
        ;;
    esac
    printf "%s\n" "$msg"
  ' \
  -- main
