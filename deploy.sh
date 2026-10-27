#!/usr/bin/env bash
# cPanel deployment: pull the Replit-built release from GitHub and restart Passenger.
# This script intentionally does not build, install packages, migrate, or seed.

set -Eeuo pipefail

APP_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
ACCOUNT_HOME="${HOME:-$(cd "$APP_DIR/../.." && pwd -P)}"
LOG_DIR="$ACCOUNT_HOME/logs"
LOG_FILE="$LOG_DIR/jobenapp-deploy.log"
BACKUP_ROOT="$ACCOUNT_HOME/.jobenapp-deploy-protect"
PHASE="${1:-}"

umask 077
mkdir -p "$LOG_DIR"

log() {
  local level="$1"
  shift
  printf '[%s] [%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$level" "$*" |
    tee -a "$LOG_FILE"
}

fail() {
  log ERROR "$*"
  exit 1
}

restore_untracked_conflicts() {
  local backup_dir="$1"
  [ -d "$backup_dir/untracked" ] || return 0
  while IFS= read -r -d '' backup_file; do
    local relative_path="${backup_file#"$backup_dir/untracked/"}"
    local destination="$APP_DIR/$relative_path"
    if [ ! -e "$destination" ]; then
      mkdir -p "$(dirname "$destination")"
      mv "$backup_file" "$destination"
    fi
  done < <(find "$backup_dir/untracked" -type f -print0)
  log WARN "File server lokal yang belum diganti dipulihkan dari cadangan."
}

on_error() {
  local status="$?"
  local line="$1"
  trap - ERR
  log ERROR "Deploy gagal pada baris $line (status $status)."
  if [ "$PHASE" != "--post-reset" ] && [ -n "${BACKUP_DIR:-}" ]; then
    restore_untracked_conflicts "$BACKUP_DIR"
  fi
  log ERROR "Cadangan privat: ${BACKUP_DIR:-tidak tersedia}"
  log ERROR "Periksa log privat: $LOG_FILE"
  exit "$status"
}
trap 'on_error "$LINENO"' ERR

activate_cpanel_node() {
  local nodeenv_dir="${CPANEL_NODEENV_DIR:-${VIRTUAL_ENV:-}}"
  if [ -z "$nodeenv_dir" ]; then
    local app_relative_path="${APP_DIR#"$ACCOUNT_HOME"/}"
    local candidate="$ACCOUNT_HOME/nodevenv/$app_relative_path"
    if [ -d "$candidate" ]; then
      nodeenv_dir="$(
        find "$candidate" -mindepth 1 -maxdepth 1 -type d -print 2>/dev/null |
          sort -V | tail -n 1
      )"
    fi
  fi

  if [ -n "$nodeenv_dir" ] && [ -f "$nodeenv_dir/bin/activate" ]; then
    local nounset_was_enabled=0 activation_status=0
    case "$-" in
      *u*) nounset_was_enabled=1; set +u ;;
    esac
    # cPanel's activation script initializes the Node.js application environment.
    # shellcheck disable=SC1090
    . "$nodeenv_dir/bin/activate" || activation_status=$?
    if [ "$nounset_was_enabled" -eq 1 ]; then
      set -u
    fi
    [ "$activation_status" -eq 0 ] || fail "Gagal mengaktifkan environment Node.js cPanel."
  fi
}

activate_cpanel_node
NODE_BIN="$(command -v node 2>/dev/null || true)"
[ -n "$NODE_BIN" ] || fail "Node.js tidak ditemukan; aktifkan aplikasi Node.js di cPanel."
NODE_MAJOR="$("$NODE_BIN" -p 'process.versions.node.split(".")[0]' 2>/dev/null || true)"
[ "$NODE_MAJOR" = "22" ] ||
  fail "Proyek memerlukan Node.js 22; versi yang terdeteksi: ${NODE_MAJOR:-tidak diketahui}."

if [ "$PHASE" = "--post-reset" ]; then
  BACKUP_DIR="${2:-}"
  BRANCH="${3:-}"
  [ -n "$BACKUP_DIR" ] && [ -d "$BACKUP_DIR" ] || fail "Cadangan deploy privat tidak ditemukan."
else
  [ "$#" -le 1 ] || fail "Penggunaan: bash deploy.sh [branch]"
  BRANCH="${1:-main}"
fi

git -C "$APP_DIR" rev-parse --git-dir >/dev/null 2>&1 || fail "Folder aplikasi bukan repository Git."
git -C "$APP_DIR" remote get-url origin >/dev/null 2>&1 || fail "Remote Git bernama origin belum disiapkan."
git check-ref-format --branch "$BRANCH" >/dev/null 2>&1 || fail "Nama branch tidak valid."

if [ "$PHASE" != "--post-reset" ]; then
  git -C "$APP_DIR" diff --quiet &&
    git -C "$APP_DIR" diff --cached --quiet ||
    fail "Ada perubahan file terlacak di cPanel. Simpan atau tinjau perubahan itu sebelum deploy."

  log INFO "Mengambil branch $BRANCH dari GitHub."
  git -C "$APP_DIR" fetch --quiet origin "$BRANCH"
  git -C "$APP_DIR" show-ref --verify --quiet "refs/remotes/origin/$BRANCH" ||
    fail "Branch origin/$BRANCH tidak ditemukan."

  for protected in .env .htaccess; do
    if git -C "$APP_DIR" cat-file -e "origin/$BRANCH:$protected" 2>/dev/null; then
      fail "$protected terlacak di GitHub; deploy dibatalkan agar konfigurasi server tidak tertimpa."
    fi
  done

  BACKUP_DIR="$(mktemp -d "$BACKUP_ROOT.XXXXXX")"
  chmod 700 "$BACKUP_DIR"
  for protected in .env .htaccess; do
    if [ -e "$APP_DIR/$protected" ]; then
      cp -a "$APP_DIR/$protected" "$BACKUP_DIR/$protected"
    fi
  done

  # cPanel may have generated untracked root files such as app.js or
  # package.json. Back up only files that collide with the GitHub release.
  while IFS= read -r tracked_path; do
    case "$tracked_path" in
      .env|.htaccess) continue ;;
    esac
    local_path="$APP_DIR/$tracked_path"
    if [ -e "$local_path" ] &&
      ! git -C "$APP_DIR" ls-files --error-unmatch "$tracked_path" >/dev/null 2>&1; then
      [ ! -d "$local_path" ] ||
        fail "Bentrok direktori lokal dengan file rilis: $tracked_path."
      mkdir -p "$BACKUP_DIR/untracked/$(dirname "$tracked_path")"
      mv "$local_path" "$BACKUP_DIR/untracked/$tracked_path"
    fi
  done < <(git -C "$APP_DIR" ls-tree -r --name-only "origin/$BRANCH")

  COMMIT_BEFORE="$(git -C "$APP_DIR" rev-parse --short HEAD 2>/dev/null || printf 'none')"
  log INFO "Memperbarui kode ke origin/$BRANCH; perubahan lokal terlacak harus bersih."
  git -C "$APP_DIR" reset --hard "origin/$BRANCH" >/dev/null

  # Reopen the updated script after reset so post-deploy checks use the new release.
  trap - ERR
  exec bash "$APP_DIR/deploy.sh" --post-reset "$BACKUP_DIR" "$BRANCH" "$COMMIT_BEFORE"
fi

# Restore server-owned files only if Git unexpectedly removed them.
for protected in .env .htaccess; do
  if [ -e "$BACKUP_DIR/$protected" ] && [ ! -e "$APP_DIR/$protected" ]; then
    cp -a "$BACKUP_DIR/$protected" "$APP_DIR/$protected"
  fi
done

for release_file in \
  app.js \
  apps/api/dist/cpanel-server.js \
  apps/api/dist/cpanel-app.js \
  apps/web/dist/index.html; do
  [ -s "$APP_DIR/$release_file" ] ||
    fail "File rilis $release_file tidak ada; build di Replit dan push hasil build ke GitHub."
  git -C "$APP_DIR" ls-files --error-unmatch "$release_file" >/dev/null 2>&1 ||
    fail "$release_file belum terlacak di Git; build di Replit lalu commit dan push hasil build."
done

if ! (cd "$APP_DIR" && "$NODE_BIN" --input-type=module -e \
  'await Promise.all(["express", "pg", "zod"].map((name) => import(name)))') >/dev/null 2>&1; then
  fail "Dependensi produksi belum terpasang. Jalankan Run NPM Install di cPanel, lalu ulangi deploy."
fi

mkdir -p "$APP_DIR/tmp"
touch "$APP_DIR/tmp/restart.txt"
COMMIT_AFTER="$(git -C "$APP_DIR" rev-parse --short HEAD)"
log INFO "Rilis $COMMIT_AFTER ($BRANCH) siap; permintaan restart Passenger telah dibuat."
log INFO "Tidak ada build, instalasi paket, migrasi database, atau seed yang dijalankan oleh deploy.sh."

rm -rf "$BACKUP_DIR"
trap - ERR
