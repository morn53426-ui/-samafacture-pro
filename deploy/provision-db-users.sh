#!/usr/bin/env bash
set -Eeuo pipefail

: "${DB_ROOT_PASSWORD:?DB_ROOT_PASSWORD est obligatoire pour provisionner les comptes MySQL}"
: "${DB_NAME:?DB_NAME est obligatoire}"
: "${DB_USER:?DB_USER doit identifier le compte SQL applicatif}"
: "${DB_PASSWORD:?DB_PASSWORD est obligatoire pour le compte applicatif}"
: "${DB_MIGRATION_USER:?DB_MIGRATION_USER doit identifier le compte de migration}"
: "${DB_MIGRATION_PASSWORD:?DB_MIGRATION_PASSWORD est obligatoire pour le compte de migration}"
: "${DB_BACKUP_USER:?DB_BACKUP_USER doit identifier le compte de sauvegarde}"
: "${DB_BACKUP_PASSWORD:?DB_BACKUP_PASSWORD est obligatoire pour le compte de sauvegarde}"

if [ "${NODE_ENV:-development}" = "production" ]; then
  if [ "$DB_USER" = "$DB_MIGRATION_USER" ] ||
     [ "$DB_USER" = "$DB_BACKUP_USER" ] ||
     [ "$DB_MIGRATION_USER" = "$DB_BACKUP_USER" ]; then
    echo "Erreur : les comptes SQL runtime, migration et sauvegarde doivent être distincts en production." >&2
    exit 1
  fi
fi

sql_string() {
  local value="${1//\\/\\\\}"
  value="${value//\'/\'\'}"
  printf "'%s'" "$value"
}

sql_identifier() {
  if [[ ! "$1" =~ ^[A-Za-z0-9_]+$ ]]; then
    echo "DB_NAME doit contenir uniquement des lettres, chiffres et underscores." >&2
    return 1
  fi
  printf '\x60%s\x60' "$1"
}

app_user="$(sql_string "$DB_USER")"
app_password="$(sql_string "$DB_PASSWORD")"
migration_user="$(sql_string "$DB_MIGRATION_USER")"
migration_password="$(sql_string "$DB_MIGRATION_PASSWORD")"
backup_user="$(sql_string "$DB_BACKUP_USER")"
backup_password="$(sql_string "$DB_BACKUP_PASSWORD")"
database="$(sql_identifier "$DB_NAME")"

# Le mot de passe root n'est transmis ni dans la ligne de commande ni dans les logs.
export MYSQL_PWD="$DB_ROOT_PASSWORD"
mysql --protocol=TCP --host="${DB_HOST:-mysql}" --user=root --batch --skip-column-names <<SQL
CREATE USER IF NOT EXISTS $migration_user@'%' IDENTIFIED BY $migration_password;
ALTER USER $migration_user@'%' IDENTIFIED BY $migration_password;
GRANT ALL PRIVILEGES ON $database.* TO $migration_user@'%';

SQL
if [ "$DB_USER" = "$DB_MIGRATION_USER" ]; then
  echo "AVERTISSEMENT : DB_USER et DB_MIGRATION_USER sont identiques. Séparation des privilèges inactive (mode développement uniquement)."
else
  mysql --protocol=TCP --host="${DB_HOST:-mysql}" --user=root --batch --skip-column-names <<SQL
CREATE USER IF NOT EXISTS $app_user@'%' IDENTIFIED BY $app_password;
ALTER USER $app_user@'%' IDENTIFIED BY $app_password;
REVOKE ALL PRIVILEGES, GRANT OPTION FROM $app_user@'%';
GRANT SELECT, INSERT, UPDATE, DELETE, EXECUTE, CREATE TEMPORARY TABLES, LOCK TABLES, SHOW VIEW
  ON $database.* TO $app_user@'%';
SQL
  echo "Compte applicatif provisionné avec droits DML uniquement ; DDL réservé au compte de migration."
fi

if [ "$DB_BACKUP_USER" = "$DB_USER" ] || [ "$DB_BACKUP_USER" = "$DB_MIGRATION_USER" ]; then
  echo "AVERTISSEMENT : DB_BACKUP_USER doit être distinct des comptes runtime et migration en production."
else
  mysql --protocol=TCP --host="${DB_HOST:-mysql}" --user=root --batch --skip-column-names <<SQL
CREATE USER IF NOT EXISTS $backup_user@'%' IDENTIFIED BY $backup_password;
ALTER USER $backup_user@'%' IDENTIFIED BY $backup_password;
REVOKE ALL PRIVILEGES, GRANT OPTION FROM $backup_user@'%';
GRANT SELECT, SHOW VIEW, TRIGGER, EVENT, LOCK TABLES ON $database.* TO $backup_user@'%';
SQL
  echo "Compte de sauvegarde provisionné : lecture et définitions des triggers uniquement."
fi

unset MYSQL_PWD
