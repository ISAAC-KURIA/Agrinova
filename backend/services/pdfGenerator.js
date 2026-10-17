async function generateScanPDF(scan, field, user) {
  const htmlPdf = require('html-pdf-node');

  // Parse JSON strings if needed
  let issues = scan.issues;
  let recommendations = scan.recommendations;
  let roi = scan.roi;

  if (typeof issues === 'string') {
    try { issues = JSON.parse(issues); } catch (e) { issues = []; }
  }
  if (typeof recommendations === 'string') {
    try { recommendations = JSON.parse(recommendations); } catch (e) { recommendations = []; }
  }
  if (typeof roi === 'string') {
    try { roi = JSON.parse(roi); } catch (e) { roi = {}; }
  }

  if (!Array.isArray(issues)) issues = [];
  if (!Array.isArray(recommendations)) recommendations = [];
  if (!roi) roi = {};

  const date = new Date().toLocaleDateString('en-KE', {
    year: 'numeric', month: 'long', day: 'numeric'
  });

  // Health score color
  let healthColor = '#2D6A4F';
  if (scan.health_score < 40) healthColor = '#C0392B';
  else if (scan.health_score < 70) healthColor = '#FFD700';

  // Prevention tips based on severity
  let preventionTips = '';
  const sev = (scan.severity || '').toLowerCase();
  if (sev === 'low') {
    preventionTips = 'Continue regular monitoring of your crops. Maintain good agronomic practices and ensure adequate nutrition.';
  } else if (sev === 'medium') {
    preventionTips = 'Increase inspection frequency. Consider preventive treatments to stop further spread. Monitor weather conditions that may worsen the situation.';
  } else {
    preventionTips = 'Act immediately. Consult your local agronomist for hands-on assessment. Isolate affected areas to prevent spread to healthy crops. Document your actions for follow-up.';
  }

  // Issues table rows
  const issueRows = issues.map(issue => `
    <tr>
      <td style="padding:8px 10px;border-bottom:1px solid #eee;">${issue.name || 'N/A'}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #eee;text-transform:capitalize;">${issue.type || 'N/A'}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #eee;text-align:center;">${issue.confidence || 0}%</td>
      <td style="padding:8px 10px;border-bottom:1px solid #eee;text-align:center;">${issue.affected_area_percent || 0}%</td>
    </tr>
  `).join('');

  // Recommendations table rows
  const recRows = recommendations.map(rec => `
    <tr>
      <td style="padding:8px 10px;border-bottom:1px solid #eee;text-align:center;font-weight:bold;">${rec.priority || '-'}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #eee;">${rec.action || 'N/A'}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #eee;text-transform:capitalize;">${rec.category || 'N/A'}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #eee;">${rec.product || 'N/A'}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #eee;">${rec.dosage || 'N/A'}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #eee;text-align:right;">KES ${(rec.cost_per_ha || 0).toLocaleString()}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #eee;text-align:center;">${rec.effectiveness_percent || 0}%</td>
      <td style="padding:8px 10px;border-bottom:1px solid #eee;text-align:center;">${rec.pre_harvest_interval || 'N/A'}</td>
    </tr>
  `).join('');

  const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Agrinova Scan Report</title>
</head>
<body style="font-family:Arial,Helvetica,sans-serif;color:#1B1B1B;background:#fff;margin:0;padding:0;">

  <!-- Header -->
  <div style="background:#2D6A4F;padding:30px 30px 20px 30px;">
    <h1 style="color:#FFD700;font-size:32px;margin:0 0 4px 0;letter-spacing:2px;">AGRINOVA</h1>
    <p style="color:#52B788;font-size:14px;margin:0 0 16px 0;">Smart Farm Intelligence</p>
    <div style="display:flex;justify-content:space-between;color:#fff;font-size:12px;">
      <span>Report Date: ${date}</span>
      <span>Scan ID: ${scan.id}</span>
    </div>
  </div>

  <!-- Farm Info -->
  <div style="background:#F8F9FA;padding:20px 30px;border-bottom:3px solid #40916C;">
    <h2 style="color:#2D6A4F;font-size:16px;margin:0 0 12px 0;text-transform:uppercase;letter-spacing:1px;">Farm Information</h2>
    <table style="width:100%;border-collapse:collapse;">
      <tr>
        <td style="padding:4px 0;width:50%;font-size:13px;"><strong>Farmer:</strong> ${user.name || 'N/A'}</td>
        <td style="padding:4px 0;font-size:13px;"><strong>Field:</strong> ${field.name || 'N/A'}</td>
      </tr>
      <tr>
        <td style="padding:4px 0;font-size:13px;"><strong>Crop Type:</strong> ${scan.crop_type || field.crop_type || 'N/A'}</td>
        <td style="padding:4px 0;font-size:13px;"><strong>Growth Stage:</strong> ${scan.growth_stage || 'N/A'}</td>
      </tr>
      <tr>
        <td style="padding:4px 0;font-size:13px;"><strong>Field Size:</strong> ${field.size_ha ? field.size_ha + ' ha' : 'N/A'}</td>
        <td style="padding:4px 0;font-size:13px;"><strong>Scan Date:</strong> ${new Date(scan.created_at).toLocaleDateString('en-KE')}</td>
      </tr>
    </table>
  </div>

  <!-- Health Score -->
  <div style="padding:24px 30px;border-bottom:1px solid #eee;">
    <h2 style="color:#2D6A4F;font-size:16px;margin:0 0 16px 0;text-transform:uppercase;letter-spacing:1px;">Crop Health Score</h2>
    <div style="display:flex;align-items:center;gap:20px;">
      <div style="background:${healthColor};color:#fff;font-size:48px;font-weight:bold;width:90px;height:90px;display:flex;align-items:center;justify-content:center;border-radius:4px;">
        ${scan.health_score || 0}
      </div>
      <div>
        <div style="background:#E9ECEF;height:16px;width:300px;border-radius:8px;overflow:hidden;">
          <div style="background:${healthColor};height:100%;width:${scan.health_score || 0}%;"></div>
        </div>
        <p style="margin:8px 0 0 0;font-size:13px;color:#666;">
          Severity: <strong style="text-transform:capitalize;">${scan.severity || 'N/A'}</strong> &nbsp;|&nbsp;
          Urgency: <strong style="text-transform:capitalize;">${(scan.urgency || 'N/A').replace('_', ' ')}</strong>
        </p>
      </div>
    </div>
  </div>

  <!-- Detected Issues -->
  <div style="padding:24px 30px;border-bottom:1px solid #eee;">
    <h2 style="color:#2D6A4F;font-size:16px;margin:0 0 16px 0;text-transform:uppercase;letter-spacing:1px;">Detected Issues</h2>
    ${issues.length > 0 ? `
    <table style="width:100%;border-collapse:collapse;font-size:13px;">
      <thead>
        <tr style="background:#2D6A4F;color:#fff;">
          <th style="padding:10px;text-align:left;">Issue Name</th>
          <th style="padding:10px;text-align:left;">Type</th>
          <th style="padding:10px;text-align:center;">Confidence</th>
          <th style="padding:10px;text-align:center;">Affected Area</th>
        </tr>
      </thead>
      <tbody>
        ${issueRows}
      </tbody>
    </table>` : '<p style="color:#666;font-size:13px;">No issues detected.</p>'}
  </div>

  <!-- AI Summary -->
  <div style="padding:24px 30px;border-bottom:1px solid #eee;">
    <h2 style="color:#2D6A4F;font-size:16px;margin:0 0 12px 0;text-transform:uppercase;letter-spacing:1px;">AI Analysis Summary</h2>
    <p style="font-size:13px;line-height:1.7;color:#2C2C2C;margin:0;">${scan.summary || 'No summary available.'}</p>
    <p style="font-size:12px;color:#666;margin:8px 0 0 0;">AI Confidence: ${Math.round((scan.ai_confidence || 0) * 100)}% &nbsp;|&nbsp; Yield Impact: ${scan.yield_impact || 0}%</p>
  </div>

  <!-- Treatment Recommendations -->
  <div style="padding:24px 30px;border-bottom:1px solid #eee;">
    <h2 style="color:#2D6A4F;font-size:16px;margin:0 0 16px 0;text-transform:uppercase;letter-spacing:1px;">Treatment Recommendations</h2>
    ${recommendations.length > 0 ? `
    <table style="width:100%;border-collapse:collapse;font-size:12px;">
      <thead>
        <tr style="background:#40916C;color:#fff;">
          <th style="padding:8px 6px;text-align:center;">Priority</th>
          <th style="padding:8px 6px;text-align:left;">Treatment</th>
          <th style="padding:8px 6px;text-align:left;">Type</th>
          <th style="padding:8px 6px;text-align:left;">Product</th>
          <th style="padding:8px 6px;text-align:left;">Dosage</th>
          <th style="padding:8px 6px;text-align:right;">Cost/ha</th>
          <th style="padding:8px 6px;text-align:center;">Effectiveness</th>
          <th style="padding:8px 6px;text-align:center;">PHI</th>
        </tr>
      </thead>
      <tbody>
        ${recRows}
      </tbody>
    </table>` : '<p style="color:#666;font-size:13px;">No recommendations available.</p>'}
  </div>

  <!-- ROI Box -->
  ${roi && Object.keys(roi).length > 0 ? `
  <div style="padding:24px 30px;border-bottom:1px solid #eee;">
    <h2 style="color:#2D6A4F;font-size:16px;margin:0 0 16px 0;text-transform:uppercase;letter-spacing:1px;">Return on Investment Analysis</h2>
    <div style="background:#2D6A4F;color:#fff;padding:20px;border-radius:4px;">
      <table style="width:100%;font-size:13px;color:#fff;">
        <tr>
          <td style="padding:6px 0;">Market Price per kg:</td>
          <td style="padding:6px 0;text-align:right;font-weight:bold;">KES ${(roi.market_price_per_kg || 0).toLocaleString()}</td>
        </tr>
        <tr>
          <td style="padding:6px 0;">Treatment Cost per ha:</td>
          <td style="padding:6px 0;text-align:right;font-weight:bold;">KES ${(roi.treatment_cost_per_ha || 0).toLocaleString()}</td>
        </tr>
        <tr>
          <td style="padding:6px 0;">Yield Saved:</td>
          <td style="padding:6px 0;text-align:right;font-weight:bold;">${(roi.yield_saved_kg_per_ha || 0).toLocaleString()} kg/ha</td>
        </tr>
        <tr>
          <td style="padding:6px 0;">Revenue Saved:</td>
          <td style="padding:6px 0;text-align:right;font-weight:bold;">KES ${(roi.revenue_saved || 0).toLocaleString()}</td>
        </tr>
        <tr style="border-top:1px solid #52B788;">
          <td style="padding:10px 0 6px 0;font-size:15px;font-weight:bold;">Net Benefit:</td>
          <td style="padding:10px 0 6px 0;text-align:right;font-size:15px;font-weight:bold;color:#FFD700;">KES ${(roi.net_benefit || 0).toLocaleString()}</td>
        </tr>
      </table>
      <div style="background:#40916C;padding:12px;margin-top:12px;text-align:center;font-size:14px;font-weight:bold;color:#FFD700;">
        ${roi.recommendation || ''}
      </div>
    </div>
  </div>` : ''}

  <!-- Prevention Tips -->
  <div style="padding:24px 30px;border-bottom:1px solid #eee;">
    <h2 style="color:#2D6A4F;font-size:16px;margin:0 0 12px 0;text-transform:uppercase;letter-spacing:1px;">Prevention Tips</h2>
    <div style="background:#F0FFF4;border-left:4px solid #40916C;padding:14px 16px;">
      <p style="font-size:13px;line-height:1.7;color:#2C2C2C;margin:0;">${preventionTips}</p>
    </div>
  </div>

  <!-- Disclaimer -->
  <div style="padding:20px 30px;background:#F8F9FA;border-top:1px solid #ddd;">
    <p style="font-size:11px;color:#888;font-style:italic;margin:0;line-height:1.6;">
      This report is AI-generated guidance. It supports but does not replace advice from a certified agronomist.
      Agrinova Health Score and issue detections are estimates based on visual analysis.
    </p>
  </div>

  <!-- Footer -->
  <div style="background:#1B1B1B;padding:16px 30px;text-align:center;">
    <p style="color:#52B788;font-size:11px;margin:0;">
      Agrinova - Smart Farm Intelligence &nbsp;|&nbsp; Report ID: ${scan.id} &nbsp;|&nbsp; Generated: ${date}
    </p>
  </div>

</body>
</html>`;

  const options = {
    format: 'A4',
    margin: { top: '20mm', right: '15mm', bottom: '20mm', left: '15mm' }
  };
  const file = { content: htmlContent };
  const buffer = await htmlPdf.generatePdf(file, options);
  return buffer;
}

module.exports = { generateScanPDF };
