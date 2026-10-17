const fs = require('fs');
const path = require('path');
const db = require('../db/database');

// Mock scenarios
const mockScenarios = [
  // Case 0: Healthy Maize
  {
    crop_type: 'Maize',
    growth_stage: 'vegetative',
    health_score: 85,
    issues: [
      {
        type: 'nutrient_deficiency',
        name: 'Mild Nitrogen Deficiency',
        confidence: 72,
        affected_area_percent: 15,
        description: 'Lower leaves showing slight yellowing indicating early nitrogen deficiency.'
      }
    ],
    severity: 'low',
    urgency: 'monitor',
    yield_impact_percent: 8,
    summary: 'Maize crop is generally healthy at the vegetative stage. Minor nitrogen deficiency detected on lower leaves. Early intervention recommended to maintain yield potential.',
    recommendations: [
      {
        priority: 1,
        action: 'Apply nitrogenous fertilizer',
        category: 'organic',
        product: 'CAN (Calcium Ammonium Nitrate)',
        dosage: '50kg per hectare',
        cost_per_ha: 2800,
        effectiveness_percent: 90,
        pre_harvest_interval: '21 days',
        notes: 'Apply in the morning when soil is moist'
      },
      {
        priority: 2,
        action: 'Foliar spray',
        category: 'organic',
        product: 'Urea foliar spray 2%',
        dosage: '20L per hectare',
        cost_per_ha: 800,
        effectiveness_percent: 75,
        pre_harvest_interval: '14 days',
        notes: 'Spray on affected lower leaves'
      }
    ]
  },
  // Case 1: Tomato with Early Blight
  {
    crop_type: 'Tomato',
    growth_stage: 'fruiting',
    health_score: 45,
    issues: [
      {
        type: 'disease',
        name: 'Early Blight (Alternaria solani)',
        confidence: 88,
        affected_area_percent: 35,
        description: 'Dark brown circular lesions with concentric rings on lower and middle leaves. Classic target-board pattern.'
      }
    ],
    severity: 'high',
    urgency: 'act_today',
    yield_impact_percent: 40,
    summary: 'Tomato crop shows significant early blight infection affecting lower and middle canopy. Immediate fungicide application is recommended. Remove and dispose of heavily infected leaves.',
    recommendations: [
      {
        priority: 1,
        action: 'Apply systemic fungicide immediately',
        category: 'chemical',
        product: 'Mancozeb 80% WP',
        dosage: '2.5kg per hectare in 200L water',
        cost_per_ha: 3500,
        effectiveness_percent: 85,
        pre_harvest_interval: '7 days',
        notes: 'Repeat every 7-10 days for 3 applications'
      },
      {
        priority: 2,
        action: 'Remove infected plant material',
        category: 'cultural',
        product: 'Manual removal',
        dosage: 'Remove all visibly infected leaves',
        cost_per_ha: 500,
        effectiveness_percent: 60,
        pre_harvest_interval: 'N/A',
        notes: 'Burn or bury removed material away from field'
      },
      {
        priority: 3,
        action: 'Copper-based preventive spray',
        category: 'organic',
        product: 'Copper oxychloride',
        dosage: '3kg per hectare',
        cost_per_ha: 2200,
        effectiveness_percent: 70,
        pre_harvest_interval: '5 days',
        notes: 'Apply after primary treatment as preventive measure'
      }
    ]
  },
  // Case 2: Beans with Bean Rust
  {
    crop_type: 'Beans',
    growth_stage: 'flowering',
    health_score: 60,
    issues: [
      {
        type: 'disease',
        name: 'Bean Rust (Uromyces appendiculatus)',
        confidence: 81,
        affected_area_percent: 25,
        description: 'Small orange-brown pustules on undersides of leaves with yellow halos on upper surface.'
      }
    ],
    severity: 'medium',
    urgency: 'this_week',
    yield_impact_percent: 22,
    summary: 'Bean crop has moderate rust infection. Reddish-brown pustules visible on leaf undersides. Apply fungicide within the week to prevent spread to pods.',
    recommendations: [
      {
        priority: 1,
        action: 'Apply triazole fungicide',
        category: 'chemical',
        product: 'Tebuconazole 25% EC',
        dosage: '1L per hectare in 200L water',
        cost_per_ha: 4200,
        effectiveness_percent: 88,
        pre_harvest_interval: '14 days',
        notes: 'Excellent systemic action against rust diseases'
      },
      {
        priority: 2,
        action: 'Increase plant spacing',
        category: 'cultural',
        product: 'Pruning and thinning',
        dosage: 'Thin to 15cm between plants',
        cost_per_ha: 300,
        effectiveness_percent: 40,
        pre_harvest_interval: 'N/A',
        notes: 'Improves air circulation to reduce humidity'
      },
      {
        priority: 3,
        action: 'Biological fungicide',
        category: 'biological',
        product: 'Bacillus subtilis (Serenade)',
        dosage: '2L per hectare',
        cost_per_ha: 3800,
        effectiveness_percent: 65,
        pre_harvest_interval: '0 days',
        notes: 'Safe to apply close to harvest'
      }
    ]
  },
  // Case 3: Maize with Fall Armyworm
  {
    crop_type: 'Maize',
    growth_stage: 'vegetative',
    health_score: 35,
    issues: [
      {
        type: 'pest',
        name: 'Fall Armyworm (Spodoptera frugiperda)',
        confidence: 93,
        affected_area_percent: 55,
        description: 'Ragged feeding damage on leaves with frass (excrement) visible in leaf whorls. Young larvae present.'
      }
    ],
    severity: 'critical',
    urgency: 'act_today',
    yield_impact_percent: 65,
    summary: 'Critical fall armyworm infestation detected. Extensive feeding damage with larvae present in leaf whorls. Immediate chemical intervention is essential to prevent total crop loss.',
    recommendations: [
      {
        priority: 1,
        action: 'Spray systemic insecticide immediately',
        category: 'chemical',
        product: 'Emamectin benzoate 1.9% EC',
        dosage: '400mL per hectare in 200L water',
        cost_per_ha: 6500,
        effectiveness_percent: 92,
        pre_harvest_interval: '14 days',
        notes: 'Apply in early morning or evening when larvae are active'
      },
      {
        priority: 2,
        action: 'Apply biological pesticide',
        category: 'biological',
        product: 'Bacillus thuringiensis (Bt)',
        dosage: '1kg per hectare',
        cost_per_ha: 4000,
        effectiveness_percent: 75,
        pre_harvest_interval: '0 days',
        notes: 'Best for young larvae stage 1-3'
      },
      {
        priority: 3,
        action: 'Sand or ash into leaf whorl',
        category: 'organic',
        product: 'Fine dry sand or wood ash',
        dosage: 'Apply small amount into whorl',
        cost_per_ha: 200,
        effectiveness_percent: 50,
        pre_harvest_interval: 'N/A',
        notes: 'Traditional method effective for young larvae'
      }
    ]
  }
];

// Map crop types to the most relevant mock scenario index
const CROP_SCENARIO_MAP = {
  // Scenario 0: Maize nitrogen deficiency (low severity)
  'maize': 0,
  'corn': 0,
  'sorghum': 0,
  'wheat': 0,
  'rice': 0,
  'barley': 0,
  'millet': 0,

  // Scenario 1: Tomato early blight (high severity)
  'tomato': 1,
  'tomatoes': 1,
  'pepper': 1,
  'capsicum': 1,
  'eggplant': 1,
  'potato': 1,

  // Scenario 2: Bean rust (medium severity)
  'beans': 2,
  'bean': 2,
  'soybean': 2,
  'pea': 2,
  'peas': 2,
  'cowpea': 2,
  'groundnut': 2,
  'legume': 2,

  // Scenario 3: Fall armyworm (critical)
  'cassava': 3,
  'kale': 3,
  'cabbage': 3,
  'onion': 3,
  'other': 3,
};

function getMockScenario(imagePath, cropType) {
  // First: use field crop type to pick a realistic matching scenario
  if (cropType) {
    const key = cropType.toLowerCase().trim();
    if (CROP_SCENARIO_MAP[key] !== undefined) {
      return mockScenarios[CROP_SCENARIO_MAP[key]];
    }
    // Partial match — scan keys for substring
    for (const [k, idx] of Object.entries(CROP_SCENARIO_MAP)) {
      if (key.includes(k) || k.includes(key)) {
        return mockScenarios[idx];
      }
    }
  }
  // Fallback: hash of filename (original behaviour)
  let sum = 0;
  for (let i = 0; i < imagePath.length; i++) {
    sum += imagePath.charCodeAt(i);
  }
  return mockScenarios[sum % 4];
}

function calculateROI(recommendations, cropType, yieldImpactPercent) {
  // Get market price from DB
  let marketPrice = 30; // default KES/kg
  try {
    const priceRow = db.prepare(
      'SELECT price_per_kg FROM market_prices WHERE crop_type = ? ORDER BY date DESC LIMIT 1'
    ).get(cropType);
    if (priceRow) marketPrice = priceRow.price_per_kg;
  } catch (e) {
    // use default
  }

  const topTwo = recommendations.slice(0, 2);
  const treatmentCostPerHa = topTwo.reduce((sum, r) => sum + (r.cost_per_ha || 0), 0);
  const yieldSavedKgPerHa = 3000 * (yieldImpactPercent / 100) * 0.8;
  const revenueSaved = yieldSavedKgPerHa * marketPrice;
  const netBenefit = revenueSaved - treatmentCostPerHa;

  return {
    market_price_per_kg: marketPrice,
    treatment_cost_per_ha: treatmentCostPerHa,
    yield_saved_kg_per_ha: Math.round(yieldSavedKgPerHa),
    revenue_saved: Math.round(revenueSaved),
    net_benefit: Math.round(netBenefit),
    recommendation: `Treat now and save approx. KES ${Math.round(netBenefit).toLocaleString()}`
  };
}

async function analyzeImage(imagePath, fieldInfo) {
  const apiKey = process.env.OPENAI_API_KEY;
  const hasValidKey = apiKey && apiKey !== 'your_openai_api_key_here' && apiKey.trim() !== '';

  let result = null;
  let usedAI = false;

  if (hasValidKey) {
    try {
      const OpenAI = require('openai');
      const client = new OpenAI({ apiKey });

      const imageBuffer = fs.readFileSync(imagePath);
      const base64Image = imageBuffer.toString('base64');
      const ext = path.extname(imagePath).toLowerCase().replace('.', '');
      const mimeType = ext === 'jpg' ? 'image/jpeg' : `image/${ext}`;

      const response = await client.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You are an expert agronomist AI. Analyze the crop image and return ONLY valid JSON (no markdown, no explanation) with this exact structure:
{
  "crop_type": "string",
  "growth_stage": "string (seedling/vegetative/flowering/fruiting/mature)",
  "health_score": number 0-100,
  "issues": [
    {
      "type": "string (disease|pest|nutrient_deficiency|water_stress|healthy)",
      "name": "string",
      "confidence": number 0-100,
      "affected_area_percent": number 0-100,
      "description": "string"
    }
  ],
  "severity": "string (low|medium|high|critical)",
  "urgency": "string (act_today|this_week|monitor|none)",
  "yield_impact_percent": number 0-100,
  "summary": "string (2-3 sentences)",
  "recommendations": [
    {
      "priority": number,
      "action": "string",
      "category": "string (organic|biological|chemical|cultural)",
      "product": "string",
      "dosage": "string",
      "cost_per_ha": number,
      "effectiveness_percent": number,
      "pre_harvest_interval": "string",
      "notes": "string"
    }
  ]
}`
          },
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: {
                  url: `data:${mimeType};base64,${base64Image}`
                }
              },
              {
                type: 'text',
                text: `Analyze this crop image. Identify the crop species directly from the image itself — do NOT use any pre-assumed crop type. Additional field context (for reference only, do not use to determine crop type): soil type: ${fieldInfo.soil_type || 'unknown'}, planting date: ${fieldInfo.planting_date || 'unknown'}. Return only the JSON.`
              }
            ]
          }
        ],
        max_tokens: 2000
      });

      const content = response.choices[0].message.content.trim();
      result = JSON.parse(content);
      usedAI = true;

      // Warn the farmer if the AI-identified crop differs from their field registration
      if (
        fieldInfo.crop_type &&
        result.crop_type &&
        result.crop_type.toLowerCase() !== fieldInfo.crop_type.toLowerCase()
      ) {
        result.summary = `[Note: AI identified this crop as "${result.crop_type}" but your field is registered as "${fieldInfo.crop_type}" — please verify.] ` + result.summary;
      }
    } catch (e) {
      console.error('OpenAI analysis failed, falling back to mock:', e.message);
      result = null;
    }
  }

  if (!result) {
    const scenario = getMockScenario(imagePath, fieldInfo.crop_type);
    // Use scenario as-is — crop_type comes from the scenario itself,
    // not from the farmer's saved field value
    result = { ...scenario };
  }

  const roi = calculateROI(result.recommendations, result.crop_type, result.yield_impact_percent);

  let aiConfidence;
  if (usedAI) {
    aiConfidence = 0.90;
  } else {
    const issues = result.issues || [];
    const avgConfidence = issues.length > 0
      ? issues.reduce((sum, i) => sum + (i.confidence || 0), 0) / issues.length
      : 80;
    aiConfidence = avgConfidence / 100;
  }

  return {
    crop_type: result.crop_type,
    growth_stage: result.growth_stage,
    health_score: result.health_score,
    issues: result.issues,
    severity: result.severity,
    urgency: result.urgency,
    yield_impact: String(result.yield_impact_percent),
    summary: result.summary,
    recommendations: result.recommendations,
    ai_confidence: aiConfidence,
    roi: roi
  };
}

module.exports = { analyzeImage };
