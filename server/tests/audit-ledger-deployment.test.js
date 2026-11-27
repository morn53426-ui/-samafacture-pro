'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..', '..');
const compose = fs.readFileSync(path.join(root, 'docker-compose.yml'), 'utf8');
const productionCompose = fs.readFileSync(path.join(root, 'docker-compose.production.yml'), 'utf8');
const app = fs.readFileSync(path.join(root, 'server', 'app.js'), 'utf8');
const db = fs.readFileSync(path.join(root, 'server', 'config', 'db.js'), 'utf8');
const backup = fs.readFileSync(path.join(root, 'server', 'config', 'backup.js'), 'utf8');
const backupWorker = fs.readFileSync(path.join(root, 'server', 'workers', 'backup-worker.js'), 'utf8');
const migrationRunner = fs.readFileSync(path.join(root, 'server', 'scripts', 'run-migrations.js'), 'utf8');
const provisioner = fs.readFileSync(path.join(root, 'deploy', 'provision-db-users.sh'), 'utf8');
const restore = fs.readFileSync(path.join(root, 'server', 'restore-backup.js'), 'utf8');

function serviceBlock(name) {
  const lines = compose.split('\n');
  const start = lines.findIndex(line => line === '  ' + name + ':');
  assert.ok(start >= 0, 'service Compose absent : ' + name);
  let end = lines.findIndex((line, index) => index > start && /^  [A-Za-z0-9_-]+:$/.test(line));
  if (end < 0) end = lines.length;
  return lines.slice(start, end).join('\n');
}

test('le processus HTTP ne reçoit aucun compte DDL ou de sauvegarde', () => {
  const block = serviceBlock('app');
  assert.match(block, /DB_USER: \$\{DB_USER\}/);
  assert.match(block, /DB_SKIP_MIGRATIONS: "true"/);
  assert.match(block, /BACKUP_SCHEDULER_DISABLED: "true"/);
  assert.match(block, /DB_MIGRATION_USER: ""/);
  assert.match(block, /DB_MIGRATION_PASSWORD: ""/);
  assert.match(block, /DB_BACKUP_USER: ""/);
  assert.match(block, /DB_BACKUP_PASSWORD: ""/);
  assert.match(block, /DB_ROOT_PASSWORD: ""/);
  assert.doesNotMatch(block, /DB_MIGRATION_USER: \$\{/);
  assert.doesNotMatch(block, /DB_BACKUP_USER: \$\{/);
  assert.match(app, /BACKUP_SCHEDULER_DISABLED !== 'true'/);
});

test('les migrations s’exécutent dans un service one-shot avant le serveur', () => {
  const mysql = serviceBlock('mysql');
  const migrate = serviceBlock('db-migrate');
  const appBlock = serviceBlock('app');
  assert.match(mysql, /log-bin-trust-function-creators=ON/);
  assert.match(migrate, /DB_MIGRATION_USER:/);
  assert.doesNotMatch(migrate, /env_file:/);
  assert.match(migrate, /DB_BACKUP_USER: ""/);
  assert.match(migrate, /DB_ROOT_PASSWORD: ""/);
  assert.match(migrate, /BACKUP_ENCRYPTION_KEY: \$\{/);
  assert.match(migrate, /app_backups:\/app\/server\/backups:ro/);
  assert.match(migrate, /scripts\/run-migrations\.js/);
  assert.match(appBlock, /db-migrate:[\s\S]*service_completed_successfully/);
  assert.match(db, /DB_SKIP_MIGRATIONS === 'true'/);
  assert.match(db, /verifyDatabaseSchemaVersion/);
  assert.match(migrationRunner, /initDatabase\(\)/);
  assert.match(migrationRunner, /pool\.end\(\)/);
  assert.match(productionCompose, /db-migrate:[\s\S]*NODE_ENV: production/);
});

test('le privilège TRIGGER est limité au worker de sauvegarde dédié', () => {
  const provision = serviceBlock('db-provision');
  const worker = serviceBlock('backup-worker');
  const appBlock = serviceBlock('app');
  assert.match(provision, /DB_BACKUP_USER:/);
  assert.match(provision, /network_mode: "service:mysql"/);
  assert.ok(provision.includes('DB_HOST: 127.0.0.1'));
  assert.ok(provisioner.includes('GRANT SELECT, SHOW VIEW, TRIGGER, EVENT, LOCK TABLES'));
  assert.match(backup, /async function verifierSchemaRegistreAudit/);
  assert.ok(backup.includes('verifyAuditLedgerSchema(connection)'));
  assert.ok(backupWorker.includes('await verifierSchemaRegistreAudit();'));
  assert.ok(backupWorker.includes('AUDIT_LEDGER_SCHEMA_CHECK_INTERVAL_MS'));
  assert.ok(backupWorker.includes('DB_BACKUP_USER'));
  assert.ok(provisioner.includes('[ "$DB_USER" = "$DB_MIGRATION_USER" ]'));
  assert.ok(provisioner.includes('[ "$DB_USER" = "$DB_BACKUP_USER" ]'));
  assert.match(worker, /DB_BACKUP_USER: \$\{DB_BACKUP_USER/);
  assert.ok(worker.includes('restart: on-failure'));
  assert.match(worker, /workers\/backup-worker\.js/);
  assert.match(worker, /app_backups:/);
  assert.match(backupWorker, /startBackupScheduler\(\{ keepAlive: true \}\)/);
  assert.match(backup, /DB_BACKUP_USER/);
  assert.match(backup, /credentials\.user/);
  assert.match(appBlock, /DB_BACKUP_USER: ""/);
  assert.doesNotMatch(appBlock, /app_backups:/);
  assert.match(appBlock, /DB_ROOT_PASSWORD: ""/);
  assert.match(appBlock, /BACKUP_ENCRYPTION_KEY: ""/);
  assert.match(productionCompose, /backup-worker:[\s\S]*NODE_ENV: production/);
});

test('la restauration utilise les identifiants DDL, jamais les identifiants du compte runtime en production', () => {
  assert.match(restore, /DB_MIGRATION_USER/);
  assert.match(restore, /DB_MIGRATION_PASSWORD/);
  assert.match(restore, /restoreUser === \(process\.env\.DB_USER \|\| 'root'\)/);
  assert.match(restore, /MYSQL_PWD: restorePassword/);
});
