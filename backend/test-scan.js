// Quick diagnostic script — run with: node test-scan.js
// Tests the full scan pipeline without HTTP

require('dotenv').config();

async function main() {
  console.log('=== Agrinova Scan Diagnostic ===\n');

  // 1. Test DB
  console.log('1. Testing database...');
  let db;
  try {
    db = require('./db/database');
    const userCount = db.prepare('SELECT COUNT(*) as c FROM users').get();
    const fieldCount = db.prepare('SELECT COUNT(*) as c FROM fields').get();
    console.log(`   OK — ${userCount.c} users, ${fieldCount.c} fields in DB`);
  } catch (e) {
    console.error('   FAIL:', e.message);
    process.exit(1);
  }

  // 2. Get a real field ID to test with
  const testField = db.prepare('SELECT * FROM fields LIMIT 1').get();
  const testUser = db.prepare('SELECT * FROM users WHERE plan = ? LIMIT 1').get('pro');
  if (!testField || !testUser) {
    console.error('   No fields/users found. Run: node seed.js');
    process.exit(1);
  }
  console.log(`   Using field: "${testField.name}" (${testField.id})`);
  console.log(`   Using user: "${testUser.email}" (${testUser.id})`);

  // 3. Create a tiny test image (1x1 white pixel JPEG)
  const fs = require('fs');
  const path = require('path');
  const testImagePath = path.join(__dirname, 'uploads', 'test-diag.jpg');

  // Minimal valid JPEG bytes
  const minJpeg = Buffer.from([
    0xFF,0xD8,0xFF,0xE0,0x00,0x10,0x4A,0x46,0x49,0x46,0x00,0x01,
    0x01,0x00,0x00,0x01,0x00,0x01,0x00,0x00,0xFF,0xDB,0x00,0x43,
    0x00,0x08,0x06,0x06,0x07,0x06,0x05,0x08,0x07,0x07,0x07,0x09,
    0x09,0x08,0x0A,0x0C,0x14,0x0D,0x0C,0x0B,0x0B,0x0C,0x19,0x12,
    0x13,0x0F,0x14,0x1D,0x1A,0x1F,0x1E,0x1D,0x1A,0x1C,0x1C,0x20,
    0x24,0x2E,0x27,0x20,0x22,0x2C,0x23,0x1C,0x1C,0x28,0x37,0x29,
    0x2C,0x30,0x31,0x34,0x34,0x34,0x1F,0x27,0x39,0x3D,0x38,0x32,
    0x3C,0x2E,0x33,0x34,0x32,0xFF,0xC0,0x00,0x0B,0x08,0x00,0x01,
    0x00,0x01,0x01,0x01,0x11,0x00,0xFF,0xC4,0x00,0x1F,0x00,0x00,
    0x01,0x05,0x01,0x01,0x01,0x01,0x01,0x01,0x00,0x00,0x00,0x00,
    0x00,0x00,0x00,0x00,0x01,0x02,0x03,0x04,0x05,0x06,0x07,0x08,
    0x09,0x0A,0x0B,0xFF,0xC4,0x00,0xB5,0x10,0x00,0x02,0x01,0x03,
    0x03,0x02,0x04,0x03,0x05,0x05,0x04,0x04,0x00,0x00,0x01,0x7D,
    0x01,0x02,0x03,0x00,0x04,0x11,0x05,0x12,0x21,0x31,0x41,0x06,
    0x13,0x51,0x61,0x07,0x22,0x71,0x14,0x32,0x81,0x91,0xA1,0x08,
    0x23,0x42,0xB1,0xC1,0x15,0x52,0xD1,0xF0,0x24,0x33,0x62,0x72,
    0x82,0x09,0x0A,0x16,0x17,0x18,0x19,0x1A,0x25,0x26,0x27,0x28,
    0x29,0x2A,0x34,0x35,0x36,0x37,0x38,0x39,0x3A,0x43,0x44,0x45,
    0xFF,0xDA,0x00,0x08,0x01,0x01,0x00,0x00,0x3F,0x00,0xFB,0xD3,
    0xFF,0xD9
  ]);

  fs.writeFileSync(testImagePath, minJpeg);
  console.log(`\n2. Test image created: ${testImagePath}`);

  // 4. Test AI analysis
  console.log('\n3. Testing AI analysis service...');
  try {
    const { analyzeImage } = require('./services/aiAnalysis');
    const result = await analyzeImage(testImagePath, testField);
    console.log('   OK — Analysis returned:');
    console.log(`   crop_type: ${result.crop_type}`);
    console.log(`   health_score: ${result.health_score}`);
    console.log(`   severity: ${result.severity}`);
    console.log(`   issues count: ${result.issues.length}`);
    console.log(`   recommendations count: ${result.recommendations.length}`);
    console.log(`   roi.net_benefit: ${result.roi?.net_benefit}`);
    console.log(`   ai_confidence: ${result.ai_confidence}`);

    // 5. Test DB insert
    console.log('\n4. Testing database INSERT...');
    const { v4: uuidv4 } = require('uuid');
    const scanId = uuidv4();
    const createdAt = new Date().toISOString();

    db.prepare(`
      INSERT INTO scans (
        id, field_id, user_id, image_path, status,
        crop_type, growth_stage, health_score, issues,
        severity, urgency, yield_impact, recommendations,
        ai_confidence, roi, summary, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      scanId, testField.id, testUser.id, 'uploads/test-diag.jpg', 'completed',
      result.crop_type, result.growth_stage, result.health_score,
      JSON.stringify(result.issues), result.severity, result.urgency,
      result.yield_impact, JSON.stringify(result.recommendations),
      result.ai_confidence, JSON.stringify(result.roi), result.summary, createdAt
    );
    console.log(`   OK — Scan inserted with ID: ${scanId}`);

    // Clean up test scan
    db.prepare('DELETE FROM scans WHERE id = ?').run(scanId);
    console.log('   Test scan cleaned up');

  } catch (e) {
    console.error('   FAIL:', e.message);
    console.error('   Stack:', e.stack);
    process.exit(1);
  }

  // Clean up test image
  try { fs.unlinkSync(testImagePath); } catch(e) {}

  console.log('\n=== ALL CHECKS PASSED ===');
  console.log('The scan pipeline is working correctly.');
  console.log('If you are still seeing errors, check:');
  console.log('  1. Your backend terminal for the exact error message');
  console.log('  2. Restart the backend after recent code changes: npm start');
  process.exit(0);
}

main().catch(e => {
  console.error('Unexpected error:', e);
  process.exit(1);
});
