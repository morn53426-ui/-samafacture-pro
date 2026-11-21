#!/usr/bin/env node
'use strict';
// Seed a disposable Sunupilot demo tenant. Never deletes or updates existing rows.
// Hard safety guard: DB_NAME must be samafacture_demo and confirmation env must be set.
require('dotenv').config();
const crypto = require('node:crypto');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const DB = 'samafacture_demo';
const CONFIRM = 'SUNUPILOT_DEMO_ONLY';
const EMAIL = 'demo.video@sunupilot.test';

function dateOffset(days) {
  const d = new Date(); d.setDate(d.getDate() - days);
  const p = n => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}
function addDays(value, days) {
  const p = value.split('-').map(Number); const d = new Date(p[0], p[1] - 1, p[2]);
  d.setDate(d.getDate() + days);
  const z = n => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + z(d.getMonth() + 1) + '-' + z(d.getDate());
}
function lineTotal(qty, price, rate) {
  const net = Math.round(qty * price * 100) / 100;
  const tax = Math.round(net * rate) / 100;
  return { net, tax, gross: Math.round((net + tax) * 100) / 100 };
}

async function main() {
  if (process.env.DB_NAME !== DB) throw new Error('Refus de connexion : DB_NAME doit être exactement ' + DB + '.');
  if (process.env.DEMO_SEED_CONFIRM !== CONFIRM) throw new Error('Définissez DEMO_SEED_CONFIRM=' + CONFIRM + ' pour confirmer.');
  const db = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost', port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root', password: process.env.DB_PASSWORD || '',
    database: DB, dateStrings: true, decimalNumbers: true
  });
  let inTransaction = false;
  try {
    const [existing] = await db.execute('SELECT id FROM users WHERE email = ? LIMIT 1', [EMAIL]);
    if (existing.length) throw new Error('Le compte démo existe déjà. Aucun enregistrement n’a été modifié. Gardez ses identifiants ou réinitialisez manuellement la base démo dédiée.');
    const password = crypto.randomBytes(24).toString('base64url');
    const hash = await bcrypt.hash(password, 12);
    await db.beginTransaction(); inTransaction = true;

    const [u] = await db.execute(
      'INSERT INTO users (nom,email,password_hash,role,entreprise_nom,entreprise_adresse,entreprise_telephone,entreprise_email,entreprise_ninea,entreprise_rccm,devise,plan) VALUES (?,?,?,\'administrateur\',?,?,?,?,?,?,\'FCFA\',\'gratuit\')',
      ['Compte vidéo Sunupilot', EMAIL, hash, 'SUNUPILOT — ENTREPRISE DE DÉMONSTRATION', 'Dakar, Sénégal — adresse fictive', '+221 77 000 00 00', EMAIL, 'SN-DEMO-0000', 'SN-DEMO-RCCM-0000']
    );
    const userId = u.insertId;

    const clients = [
      ['Boutique Teranga — DÉMO','contact@teranga.example.test','+221 77 000 00 01','+221 77 000 00 01','Dakar — adresse fictive'],
      ['Atelier Baobab — DÉMO','atelier@baobab.example.test','+221 77 000 00 02','+221 77 000 00 02','Thiès — adresse fictive'],
      ['Services Niani — DÉMO','bonjour@niani.example.test','+221 77 000 00 03','+221 77 000 00 03','Saint-Louis — adresse fictive']
    ];
    const clientIds = [];
    for (const c of clients) {
      const [r] = await db.execute('INSERT INTO clients (user_id,nom,email,telephone,whatsapp,adresse,notes) VALUES (?,?,?,?,?,?,?)',
        [userId, ...c, 'Donnée fictive pour la démonstration Sunupilot.']);
      clientIds.push(r.insertId);
    }

    const products = [
      ['Pack entretien professionnel — DÉMO','produit','DEMO-PROD-001',25000,18,18,'Équipement'],
      ['Consommables boutique — DÉMO','produit','DEMO-PROD-002',15000,18,42,'Consommables'],
      ['Prestation de maintenance — DÉMO','service','DEMO-SVC-001',50000,18,0,'Services'],
      ['Conseil en gestion — DÉMO','service','DEMO-SVC-002',35000,18,0,'Services']
    ];
    const productIds = [];
    for (const p of products) {
      const [r] = await db.execute('INSERT INTO produits (user_id,nom,type_catalogue,reference,prix_ht,tva,stock,categorie,description) VALUES (?,?,?,?,?,?,?,?,?)',
        [userId, ...p, 'Article fictif pour le compte de démonstration Sunupilot.']);
      productIds.push(r.insertId);
    }

    async function addDocument(d) {
      const issued = dateOffset(d.daysAgo); const due = addDays(issued, d.dueIn);
      const rows = d.lines.map(x => Object.assign({}, x, { amount: lineTotal(x.qty, x.price, x.rate) }));
      const subtotal = rows.reduce((s, x) => s + x.amount.net, 0);
      const vat = rows.reduce((s, x) => s + x.amount.tax, 0);
      const total = Math.round((subtotal + vat) * 100) / 100;
      const [r] = await db.execute(
        'INSERT INTO factures (user_id,client_id,numero,type,date_emission,date_echeance,statut,mode_paiement,objet,conditions_reglement,sous_total,total_tva,total,montant_paye) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
        [userId,d.clientId,d.number,d.type,issued,due,d.status,d.method || null,d.subject,'Jeu de démonstration fictif.',subtotal,vat,total,d.payment || 0]
      );
      for (const x of rows) await db.execute(
        'INSERT INTO facture_lignes (facture_id,produit_id,designation,quantite,prix_unitaire,tva,total_ligne) VALUES (?,?,?,?,?,?,?)',
        [r.insertId,x.productId,x.name,x.qty,x.price,x.rate,x.amount.gross]
      );
      if (d.payment > 0) await db.execute(
        'INSERT INTO paiements (user_id,facture_id,montant,methode,reference,date_paiement) VALUES (?,?,?,?,?,?)',
        [userId,r.insertId,d.payment,d.method,'DEMO-' + d.number,issued + ' 12:00:00']
      );
      return total;
    }

    const paid = await addDocument({
      clientId:clientIds[0],number:'DEMO-FAC-2026-001',type:'facture',daysAgo:24,dueIn:15,status:'payee',payment:153400,method:'wave',subject:'Équipement et consommables — DÉMO',
      lines:[{productId:productIds[0],name:products[0][0],qty:4,price:25000,rate:18},{productId:productIds[1],name:products[1][0],qty:2,price:15000,rate:18}]
    });
    const partial = await addDocument({
      clientId:clientIds[1],number:'DEMO-FAC-2026-002',type:'facture',daysAgo:12,dueIn:18,status:'en_attente',payment:45000,method:'especes',subject:'Maintenance — DÉMO',
      lines:[{productId:productIds[2],name:products[2][0],qty:2,price:50000,rate:18}]
    });
    const late = await addDocument({
      clientId:clientIds[2],number:'DEMO-FAC-2026-003',type:'facture',daysAgo:42,dueIn:-12,status:'en_retard',subject:'Conseil en gestion — DÉMO',
      lines:[{productId:productIds[3],name:products[3][0],qty:1,price:35000,rate:18}]
    });
    const quote = await addDocument({
      clientId:clientIds[0],number:'DEMO-DEV-2026-001',type:'devis',daysAgo:4,dueIn:20,status:'en_attente',subject:'Proposition commerciale — DÉMO',
      lines:[{productId:productIds[0],name:products[0][0],qty:3,price:25000,rate:18},{productId:productIds[2],name:products[2][0],qty:1,price:50000,rate:18}]
    });

    const expenses = [
      ['Approvisionnement boutique — DÉMO',45000,'Achats',dateOffset(18)],
      ['Transport et livraison — DÉMO',12000,'Transport',dateOffset(9)],
      ['Fournitures de bureau — DÉMO',8500,'Fournitures',dateOffset(5)],
      ['Entretien local — DÉMO',20000,'Entretien',dateOffset(2)]
    ];
    for (const e of expenses) await db.execute(
      'INSERT INTO depenses (user_id,libelle,montant,categorie,date_depense,notes) VALUES (?,?,?,?,?,?)',
      [userId,...e,'Dépense fictive du jeu de démonstration Sunupilot.']
    );

    await db.commit(); inTransaction = false;
    console.log('\nCOMPTE DE DÉMONSTRATION SUNUPILOT CRÉÉ');
    console.log('Base : ' + DB);
    console.log('URL : http://localhost:4000/login.html');
    console.log('Email : ' + EMAIL);
    console.log('Mot de passe temporaire : ' + password);
    console.log('\nDocuments :');
    console.log('- Facture payée : ' + paid.toLocaleString('fr-FR') + ' FCFA');
    console.log('- Facture partielle : ' + partial.toLocaleString('fr-FR') + ' FCFA (45 000 FCFA enregistrés)');
    console.log('- Facture en retard : ' + late.toLocaleString('fr-FR') + ' FCFA');
    console.log('- Devis : ' + quote.toLocaleString('fr-FR') + ' FCFA');
    console.log('\nTous les clients, contacts et montants sont fictifs. Copiez le mot de passe maintenant : il ne sera pas réaffiché.\n');
  } catch (error) {
    if (inTransaction) await db.rollback();
    throw error;
  } finally {
    await db.end();
  }
}
main().catch(error => { console.error('\nERREUR — ' + error.message + '\n'); process.exitCode = 1; });
