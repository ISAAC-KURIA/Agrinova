require('dotenv').config();
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const db = require('./db/database');

async function seed() {
  try {
    // Check if already seeded
    const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get('demo@agrinova.com');
    if (existingUser) {
      console.log('Already seeded. Skipping.');
      return;
    }

    console.log('Seeding database...');

    // --- USERS ---
    const usersData = [
      { email: 'demo@agrinova.com', password: 'demo1234', name: 'Demo Farmer', phone: '+254700000001', role: 'farmer', plan: 'pro' },
      { email: 'jane@agrinova.com', password: 'demo1234', name: 'Jane Wambua', phone: '+254700000002', role: 'farmer', plan: 'free' },
      { email: 'john@agrinova.com', password: 'demo1234', name: 'John Kamau', phone: '+254700000003', role: 'farmer', plan: 'free' }
    ];

    const userIds = {};
    for (const u of usersData) {
      const id = uuidv4();
      const passwordHash = await bcrypt.hash(u.password, 10);
      db.prepare(`
        INSERT INTO users (id, email, password_hash, name, phone, role, plan, scans_this_month, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)
      `).run(id, u.email, passwordHash, u.name, u.phone, u.role, u.plan, new Date().toISOString());
      userIds[u.email] = id;
    }
    console.log('  Users created.');

    // --- FIELDS ---
    const demoId = userIds['demo@agrinova.com'];
    const janeId = userIds['jane@agrinova.com'];
    const johnId = userIds['john@agrinova.com'];

    const fieldsData = [
      { user_id: demoId, name: 'Upper Maize Field', crop_type: 'Maize', size_ha: 2.5, location_lat: -1.2921, location_lng: 36.8219, soil_type: 'loam', planting_date: '2024-02-01' },
      { user_id: demoId, name: 'Tomato Greenhouse', crop_type: 'Tomato', size_ha: 0.8, location_lat: -1.2935, location_lng: 36.8240, soil_type: 'sandy', planting_date: '2024-03-15' },
      { user_id: janeId, name: 'Jane Bean Plot', crop_type: 'Beans', size_ha: 1.2, location_lat: -1.3050, location_lng: 36.8100, soil_type: 'clay', planting_date: '2024-01-20' },
      { user_id: johnId, name: 'John Wheat Farm', crop_type: 'Wheat', size_ha: 3.0, location_lat: -1.2800, location_lng: 36.8350, soil_type: 'loam', planting_date: '2023-12-01' },
      { user_id: johnId, name: 'John Rice Paddy', crop_type: 'Rice', size_ha: 1.5, location_lat: -1.2750, location_lng: 36.8400, soil_type: 'silty', planting_date: '2024-02-15' }
    ];

    const fieldIds = {};
    for (const f of fieldsData) {
      const id = uuidv4();
      db.prepare(`
        INSERT INTO fields (id, user_id, name, location_lat, location_lng, size_ha, crop_type, planting_date, soil_type, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(id, f.user_id, f.name, f.location_lat, f.location_lng, f.size_ha, f.crop_type, f.planting_date, f.soil_type, new Date().toISOString());
      fieldIds[f.name] = id;
    }
    console.log('  Fields created.');

    // --- SCAN SCENARIOS (hardcoded mock data) ---
    const scenario0 = {
      crop_type: 'Maize', growth_stage: 'vegetative', health_score: 85,
      issues: [{ type: 'nutrient_deficiency', name: 'Mild Nitrogen Deficiency', confidence: 72, affected_area_percent: 15, description: 'Lower leaves showing slight yellowing indicating early nitrogen deficiency.' }],
      severity: 'low', urgency: 'monitor', yield_impact: '8',
      summary: 'Maize crop is generally healthy at the vegetative stage. Minor nitrogen deficiency detected on lower leaves. Early intervention recommended to maintain yield potential.',
      recommendations: [
        { priority: 1, action: 'Apply nitrogenous fertilizer', category: 'organic', product: 'CAN (Calcium Ammonium Nitrate)', dosage: '50kg per hectare', cost_per_ha: 2800, effectiveness_percent: 90, pre_harvest_interval: '21 days', notes: 'Apply in the morning when soil is moist' },
        { priority: 2, action: 'Foliar spray', category: 'organic', product: 'Urea foliar spray 2%', dosage: '20L per hectare', cost_per_ha: 800, effectiveness_percent: 75, pre_harvest_interval: '14 days', notes: 'Spray on affected lower leaves' }
      ],
      ai_confidence: 0.86,
      roi: { market_price_per_kg: 28, treatment_cost_per_ha: 3600, yield_saved_kg_per_ha: 192, revenue_saved: 5376, net_benefit: 1776, recommendation: 'Treat now and save approx. KES 1,776' }
    };

    const scenario1 = {
      crop_type: 'Tomato', growth_stage: 'fruiting', health_score: 45,
      issues: [{ type: 'disease', name: 'Early Blight (Alternaria solani)', confidence: 88, affected_area_percent: 35, description: 'Dark brown circular lesions with concentric rings on lower and middle leaves. Classic target-board pattern.' }],
      severity: 'high', urgency: 'act_today', yield_impact: '40',
      summary: 'Tomato crop shows significant early blight infection affecting lower and middle canopy. Immediate fungicide application is recommended. Remove and dispose of heavily infected leaves.',
      recommendations: [
        { priority: 1, action: 'Apply systemic fungicide immediately', category: 'chemical', product: 'Mancozeb 80% WP', dosage: '2.5kg per hectare in 200L water', cost_per_ha: 3500, effectiveness_percent: 85, pre_harvest_interval: '7 days', notes: 'Repeat every 7-10 days for 3 applications' },
        { priority: 2, action: 'Remove infected plant material', category: 'cultural', product: 'Manual removal', dosage: 'Remove all visibly infected leaves', cost_per_ha: 500, effectiveness_percent: 60, pre_harvest_interval: 'N/A', notes: 'Burn or bury removed material away from field' },
        { priority: 3, action: 'Copper-based preventive spray', category: 'organic', product: 'Copper oxychloride', dosage: '3kg per hectare', cost_per_ha: 2200, effectiveness_percent: 70, pre_harvest_interval: '5 days', notes: 'Apply after primary treatment as preventive measure' }
      ],
      ai_confidence: 0.88,
      roi: { market_price_per_kg: 45, treatment_cost_per_ha: 4000, yield_saved_kg_per_ha: 960, revenue_saved: 43200, net_benefit: 39200, recommendation: 'Treat now and save approx. KES 39,200' }
    };

    const scenario2 = {
      crop_type: 'Beans', growth_stage: 'flowering', health_score: 60,
      issues: [{ type: 'disease', name: 'Bean Rust (Uromyces appendiculatus)', confidence: 81, affected_area_percent: 25, description: 'Small orange-brown pustules on undersides of leaves with yellow halos on upper surface.' }],
      severity: 'medium', urgency: 'this_week', yield_impact: '22',
      summary: 'Bean crop has moderate rust infection. Reddish-brown pustules visible on leaf undersides. Apply fungicide within the week to prevent spread to pods.',
      recommendations: [
        { priority: 1, action: 'Apply triazole fungicide', category: 'chemical', product: 'Tebuconazole 25% EC', dosage: '1L per hectare in 200L water', cost_per_ha: 4200, effectiveness_percent: 88, pre_harvest_interval: '14 days', notes: 'Excellent systemic action against rust diseases' },
        { priority: 2, action: 'Increase plant spacing', category: 'cultural', product: 'Pruning and thinning', dosage: 'Thin to 15cm between plants', cost_per_ha: 300, effectiveness_percent: 40, pre_harvest_interval: 'N/A', notes: 'Improves air circulation to reduce humidity' },
        { priority: 3, action: 'Biological fungicide', category: 'biological', product: 'Bacillus subtilis (Serenade)', dosage: '2L per hectare', cost_per_ha: 3800, effectiveness_percent: 65, pre_harvest_interval: '0 days', notes: 'Safe to apply close to harvest' }
      ],
      ai_confidence: 0.85,
      roi: { market_price_per_kg: 120, treatment_cost_per_ha: 4500, yield_saved_kg_per_ha: 528, revenue_saved: 63360, net_benefit: 58860, recommendation: 'Treat now and save approx. KES 58,860' }
    };

    const scenario3 = {
      crop_type: 'Maize', growth_stage: 'vegetative', health_score: 35,
      issues: [{ type: 'pest', name: 'Fall Armyworm (Spodoptera frugiperda)', confidence: 93, affected_area_percent: 55, description: 'Ragged feeding damage on leaves with frass (excrement) visible in leaf whorls. Young larvae present.' }],
      severity: 'critical', urgency: 'act_today', yield_impact: '65',
      summary: 'Critical fall armyworm infestation detected. Extensive feeding damage with larvae present in leaf whorls. Immediate chemical intervention is essential to prevent total crop loss.',
      recommendations: [
        { priority: 1, action: 'Spray systemic insecticide immediately', category: 'chemical', product: 'Emamectin benzoate 1.9% EC', dosage: '400mL per hectare in 200L water', cost_per_ha: 6500, effectiveness_percent: 92, pre_harvest_interval: '14 days', notes: 'Apply in early morning or evening when larvae are active' },
        { priority: 2, action: 'Apply biological pesticide', category: 'biological', product: 'Bacillus thuringiensis (Bt)', dosage: '1kg per hectare', cost_per_ha: 4000, effectiveness_percent: 75, pre_harvest_interval: '0 days', notes: 'Best for young larvae stage 1-3' },
        { priority: 3, action: 'Sand or ash into leaf whorl', category: 'organic', product: 'Fine dry sand or wood ash', dosage: 'Apply small amount into whorl', cost_per_ha: 200, effectiveness_percent: 50, pre_harvest_interval: 'N/A', notes: 'Traditional method effective for young larvae' }
      ],
      ai_confidence: 0.93,
      roi: { market_price_per_kg: 28, treatment_cost_per_ha: 10500, yield_saved_kg_per_ha: 1560, revenue_saved: 43680, net_benefit: 33180, recommendation: 'Treat now and save approx. KES 33,180' }
    };

    // 8 scans spread across fields and time
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;

    const scansData = [
      { scenario: scenario0, field_id: fieldIds['Upper Maize Field'], user_id: demoId, daysAgo: 55 },
      { scenario: scenario1, field_id: fieldIds['Tomato Greenhouse'], user_id: demoId, daysAgo: 45 },
      { scenario: scenario3, field_id: fieldIds['Upper Maize Field'], user_id: demoId, daysAgo: 30 },
      { scenario: scenario1, field_id: fieldIds['Tomato Greenhouse'], user_id: demoId, daysAgo: 15 },
      { scenario: scenario2, field_id: fieldIds['Jane Bean Plot'], user_id: janeId, daysAgo: 40 },
      { scenario: scenario2, field_id: fieldIds['Jane Bean Plot'], user_id: janeId, daysAgo: 10 },
      { scenario: scenario0, field_id: fieldIds['John Wheat Farm'], user_id: johnId, daysAgo: 35 },
      { scenario: scenario3, field_id: fieldIds['John Rice Paddy'], user_id: johnId, daysAgo: 20 }
    ];

    const insertScan = db.prepare(`
      INSERT INTO scans (id, field_id, user_id, image_path, status, crop_type, growth_stage, health_score, issues, severity, urgency, yield_impact, recommendations, ai_confidence, roi, summary, created_at)
      VALUES (?, ?, ?, 'uploads/sample.jpg', 'completed', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertTreatment = db.prepare(`
      INSERT INTO treatments (id, scan_id, name, type, dosage, cost_per_ha, effectiveness, pre_harvest_interval, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const s of scansData) {
      const scanId = uuidv4();
      const createdAt = new Date(now - s.daysAgo * day).toISOString();
      const sc = s.scenario;

      insertScan.run(
        scanId, s.field_id, s.user_id,
        sc.crop_type, sc.growth_stage, sc.health_score,
        JSON.stringify(sc.issues), sc.severity, sc.urgency,
        sc.yield_impact, JSON.stringify(sc.recommendations),
        sc.ai_confidence, JSON.stringify(sc.roi), sc.summary, createdAt
      );

      for (const rec of sc.recommendations) {
        insertTreatment.run(
          uuidv4(), scanId,
          rec.product || rec.action,
          rec.category,
          rec.dosage,
          rec.cost_per_ha,
          rec.effectiveness_percent,
          rec.pre_harvest_interval,
          rec.notes
        );
      }
    }
    console.log('  Scans and treatments created.');

    // --- MARKET PRICES ---
    const today = new Date();
    const formatDate = (d) => d.toISOString().split('T')[0];

    const crops = [
      { crop_type: 'Maize', price: 28, region: 'Nairobi', trend: 'up' },
      { crop_type: 'Tomato', price: 45, region: 'Nairobi', trend: 'down' },
      { crop_type: 'Beans', price: 120, region: 'Nairobi', trend: 'stable' },
      { crop_type: 'Wheat', price: 52, region: 'Nairobi', trend: 'up' },
      { crop_type: 'Rice', price: 95, region: 'Nairobi', trend: 'stable' },
      { crop_type: 'Potato', price: 35, region: 'Nairobi', trend: 'down' }
    ];

    const insertPrice = db.prepare(`
      INSERT INTO market_prices (id, crop_type, price_per_kg, region, date, trend)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    for (const c of crops) {
      // Today's price
      insertPrice.run(uuidv4(), c.crop_type, c.price, c.region, formatDate(today), c.trend);

      // Historical prices: 10, 20, 30 days ago with slight variation
      const variations = [
        { days: 10, factor: c.trend === 'up' ? 0.96 : c.trend === 'down' ? 1.04 : 0.99 },
        { days: 20, factor: c.trend === 'up' ? 0.92 : c.trend === 'down' ? 1.08 : 1.01 },
        { days: 30, factor: c.trend === 'up' ? 0.88 : c.trend === 'down' ? 1.12 : 0.98 }
      ];
      for (const v of variations) {
        const d = new Date(today);
        d.setDate(d.getDate() - v.days);
        const historicalPrice = Math.round(c.price * v.factor * 100) / 100;
        insertPrice.run(uuidv4(), c.crop_type, historicalPrice, c.region, formatDate(d), c.trend);
      }
    }
    console.log('  Market prices created.');

    // --- FARM INPUTS for Demo Farmer ---
    const inputsData = [
      { user_id: demoId, field_id: fieldIds['Upper Maize Field'], type: 'seeds', name: 'Maize seeds', quantity: 25, unit: 'kg', cost: 3500, date: formatDate(today), notes: '1 bag certified hybrid seeds' },
      { user_id: demoId, field_id: fieldIds['Upper Maize Field'], type: 'fertilizer', name: 'CAN fertilizer', quantity: 50, unit: 'kg', cost: 4200, date: formatDate(today), notes: 'Calcium Ammonium Nitrate' },
      { user_id: demoId, field_id: fieldIds['Tomato Greenhouse'], type: 'pesticide', name: 'Pesticide spray', quantity: 1, unit: 'L', cost: 2800, date: formatDate(today), notes: 'Broad-spectrum insecticide' },
      { user_id: demoId, field_id: fieldIds['Upper Maize Field'], type: 'labour', name: 'Labour (land prep)', quantity: 2, unit: 'days', cost: 1200, date: formatDate(today), notes: 'Land preparation labour' }
    ];

    const insertInput = db.prepare(`
      INSERT INTO farm_inputs (id, user_id, field_id, type, name, quantity, unit, cost, date, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const inp of inputsData) {
      insertInput.run(uuidv4(), inp.user_id, inp.field_id, inp.type, inp.name, inp.quantity, inp.unit, inp.cost, inp.date, inp.notes);
    }
    console.log('  Farm inputs created.');

    console.log('\nSeed complete!');
    console.log('  demo@agrinova.com / demo1234');
    console.log('  jane@agrinova.com / demo1234');
    console.log('  john@agrinova.com / demo1234');

  } catch (err) {
    if (err.message && err.message.includes('UNIQUE constraint failed')) {
      console.log('Already seeded or partial seed. Skipping.');
    } else {
      console.error('Seed error:', err);
      process.exit(1);
    }
  }
}

seed();
