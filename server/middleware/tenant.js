const { pool } = require('../config/db');

const ROLE_PERMISSIONS = {
  proprietaire: ['*'],
  administrateur: ['*'],
  manager: ['dashboard.read', 'clients.read', 'clients.write', 'products.read', 'products.write', 'invoices.read', 'invoices.write', 'payments.read', 'payments.write', 'expenses.read', 'expenses.write', 'reports.read', 'documents.read', 'documents.write', 'sales.read', 'sales.write', 'purchasing.read', 'purchasing.write', 'inventory.read', 'inventory.write', 'accounting.read', 'accounting.write', 'cash.read', 'cash.write', 'team.read', 'audit.read'],
  comptable: ['dashboard.read', 'clients.read', 'products.read', 'invoices.read', 'payments.read', 'payments.write', 'expenses.read', 'expenses.write', 'reports.read', 'accounting.read', 'accounting.write', 'documents.read', 'documents.write', 'audit.read'],
  commercial: ['dashboard.read', 'clients.read', 'clients.write', 'products.read', 'invoices.read', 'invoices.write', 'sales.read', 'sales.write', 'documents.read'],
  caissier: ['dashboard.read', 'clients.read', 'invoices.read', 'payments.read', 'payments.write', 'cash.read', 'cash.write'],
  employe: ['dashboard.read', 'clients.read', 'products.read', 'invoices.read', 'sales.read'],
  lecture_seule: ['dashboard.read', 'clients.read', 'products.read', 'invoices.read', 'payments.read', 'expenses.read', 'reports.read', 'documents.read', 'sales.read', 'cash.read', 'team.read']
};

function parsePermissions(value, role) {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed;
    } catch (_) {}
  }
  return ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.lecture_seule;
}

async function resolveTenant(req, res, next) {
  try {
    req.actorId = Number(req.user.id);
    req.tenantId = req.actorId;
    req.companyMembership = null;
    req.permissions = ROLE_PERMISSIONS.proprietaire;

    const isInviteAcceptance = (req.baseUrl || '').endsWith('/pro') && (req.path || '').startsWith('/team/invitations/accept');
    const requestedOwner = isInviteAcceptance ? null : req.get('X-SF-Company-Owner');
    if (requestedOwner) {
      if (!/^\d+$/.test(requestedOwner)) return res.status(400).json({ error: 'Sélection d’entreprise invalide.' });
      const selectedOwner = Number(requestedOwner);
      if (selectedOwner === req.actorId) {
        // Le membre peut toujours revenir à son espace personnel.
        req.tenantId = req.actorId;
        req.companyMembership = null;
        req.permissions = ROLE_PERMISSIONS.proprietaire;
      } else {
        const [rows] = await pool.query(
          'SELECT owner_user_id, role, permissions_json FROM pro_team_members WHERE member_user_id = ? AND owner_user_id = ? AND active = 1 LIMIT 1',
          [req.actorId, selectedOwner]
        );
        if (!rows.length) return res.status(403).json({ error: 'Vous ne faites pas partie de cette entreprise.' });
        req.tenantId = Number(rows[0].owner_user_id);
        req.companyMembership = rows[0];
        req.permissions = parsePermissions(rows[0].permissions_json, rows[0].role);
      }
    }
    next();
  } catch (err) {
    next(err);
  }
}

function permissionForRequest(req) {
  const base = req.baseUrl || '';
  const path = req.path || '/';
  const method = req.method;

  if (base.endsWith('/dashboard')) return 'dashboard.read';
  if (base.endsWith('/clients')) return method === 'GET' ? 'clients.read' : 'clients.write';
  if (base.endsWith('/produits')) return method === 'GET' ? 'products.read' : 'products.write';
  if (base.endsWith('/depenses')) return method === 'GET' ? 'expenses.read' : 'expenses.write';
  if (base.endsWith('/rapports')) return 'reports.read';
  if (base.endsWith('/factures-recurrentes')) return method === 'GET' ? 'invoices.read' : 'invoices.write';
  if (base.endsWith('/factures')) {
    if (/\/paiements(?:\/|$)/.test(path)) return method === 'GET' ? 'payments.read' : 'payments.write';
    return method === 'GET' ? 'invoices.read' : 'invoices.write';
  }
  if (base.endsWith('/pro')) {
    if (path.startsWith('/team/invitations/accept') || path.startsWith('/team/companies')) return null;
    if (path.startsWith('/team')) return method === 'GET' ? 'team.read' : 'team.manage';
    if (/^\\/invoices\\/\\d+\\/checkout(?:\\/|$)/.test(path)) return 'payments.write';
    if (path.startsWith('/payment-gateways')) return method === 'GET' ? 'integrations.read' : 'integrations.manage';
    if (path.startsWith('/payments') || path.startsWith('/payment-links') || path.startsWith('/refunds') || path.startsWith('/deposits')) {
      return method === 'GET' ? 'payments.read' : 'payments.write';
    }
    if (path.startsWith('/cash') || path.startsWith('/establishments')) return method === 'GET' ? 'cash.read' : 'cash.write';
    if (path.startsWith('/documents')) return method === 'GET' ? 'documents.read' : 'documents.write';
    if (path.startsWith('/reports')) return 'reports.read';
    if (path.startsWith('/integrations')) return method === 'GET' ? 'integrations.read' : 'integrations.manage';
    if (path.startsWith('/automations')) return method === 'GET' ? 'automations.read' : 'automations.manage';
    if (path.startsWith('/accounting')) return method === 'GET' ? 'accounting.read' : 'accounting.write';
    if (path.startsWith('/suppliers') || path.startsWith('/purchase-orders')) return method === 'GET' ? 'purchasing.read' : 'purchasing.write';
    if (path.startsWith('/warehouses') || path.startsWith('/inventory')) return method === 'GET' ? 'inventory.read' : 'inventory.write';
    if (path.startsWith('/audit')) return 'audit.read';
    if (path.startsWith('/clients')) return method === 'GET' ? 'clients.read' : 'clients.write';
    if (path.startsWith('/credit-notes')) return method === 'GET' ? 'sales.read' : 'invoices.write';
    if (path.startsWith('/orders') || path.startsWith('/delivery-notes')) return method === 'GET' ? 'sales.read' : 'sales.write';
    return 'admin.only';
  }
  return null;
}

function requirePermission(req, res, next) {
  const permission = permissionForRequest(req);
  const writeImpliesRead = {
    'clients.read': 'clients.write',
    'products.read': 'products.write',
    'invoices.read': 'invoices.write',
    'payments.read': 'payments.write',
    'expenses.read': 'expenses.write',
    'documents.read': 'documents.write',
    'sales.read': 'sales.write',
    'cash.read': 'cash.write',
    'team.read': 'team.manage',
    'integrations.read': 'integrations.manage',
    'automations.read': 'automations.manage',
    'purchasing.read': 'purchasing.write',
    'inventory.read': 'inventory.write',
    'accounting.read': 'accounting.write'
  };
  if (!permission || req.permissions.includes('*') || req.permissions.includes(permission) ||
      (writeImpliesRead[permission] && req.permissions.includes(writeImpliesRead[permission]))) return next();
  return res.status(403).json({ error: 'Cette action n’est pas autorisée pour votre rôle.' });
}

module.exports = { resolveTenant, requirePermission, ROLE_PERMISSIONS, parsePermissions };
