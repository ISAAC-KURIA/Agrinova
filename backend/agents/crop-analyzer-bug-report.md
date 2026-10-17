# Crop Analyzer Bug Report

**Date:** Investigation findings  
**File:** `backend/services/aiAnalysis.js`, `backend/routes/scans.js`

---

## Summary (Root Cause First)

The analyzer has **two separate bugs** — one in the mock/fallback path and one in the real OpenAI path — both of which cause the reported symptom: the crop type in the result reflects what the farmer saved in their field profile rather than what the AI identified from the image.

---

## Evidence

### Bug 1 — Mock path hard-overwrites `crop_type` with the saved field value

**File:** `backend/services/aiAnalysis.js`, lines ~210–215 (inside `analyzeImage`)

```js
if (!result) {
  const scenario = getMockScenario(imagePath, fieldInfo.crop_type);
  // Clone scenario and override crop_type to match the actual field crop
  result = {
    ...scenario,
    crop_type: fieldInfo.crop_type || scenario.crop_type,  // ← BUG
  };
}
```

The spread `...scenario` already contains a correct `crop_type` from the mock scenario (e.g. `"Maize"`, `"Tomato"`, `"Beans"`). The override `crop_type: fieldInfo.crop_type || scenario.crop_type` then unconditionally replaces it with whatever the farmer typed when they created their field record. If the farmer saved `"Maize"` for a field but uploads a photo of a tomato plant, the result will say `crop_type: "Maize"`.

The comment in the code even says *"override crop_type to match the actual field crop"* — confirming the developer intentionally added this line, but the intent is wrong: this is the mock/fallback path, so there is no real image analysis happening. The scenario was already chosen to match the field crop; the extra override is redundant at best and misleading at worst.

**Function responsible:** `getMockScenario(imagePath, cropType)` (lines ~172–195)

```js
function getMockScenario(imagePath, cropType) {
  if (cropType) {
    const key = cropType.toLowerCase().trim();
    if (CROP_SCENARIO_MAP[key] !== undefined) {
      return mockScenarios[CROP_SCENARIO_MAP[key]];
    }
    // partial match...
  }
  // fallback hash
}
```

`getMockScenario` is passed `fieldInfo.crop_type` directly — the saved field value — so scenario selection is also entirely driven by the saved crop name, not by any image content. This is expected for mock mode, but means the system never identifies the crop from the image in mock mode.

---

### Bug 2 — OpenAI prompt leaks the saved crop type as a hint

**File:** `backend/services/aiAnalysis.js`, lines ~244–260 (inside the OpenAI branch)

```js
{
  type: 'text',
  text: `Analyze this crop image. Field info: crop type: ${fieldInfo.crop_type || 'unknown'}, ...`
}
```

The user message sent to GPT-4o explicitly includes `crop type: <saved field value>`. For a model like GPT-4o, this is a strong anchor. When the prompt says *"crop type: Maize"*, the model almost always outputs `"crop_type": "Maize"` in its JSON regardless of what plant is actually in the image, because:

1. It is presented as authoritative ground truth from a field record.
2. The system prompt says to analyze "the crop" — the model interprets the named crop as the subject.
3. Models follow context anchors to avoid contradicting the user.

This means even with a real OpenAI key, if a farmer scans a tomato plant on a field registered as `crop_type: "Maize"`, the AI will likely return `"crop_type": "Maize"`.

---

### How the field data flows into the AI call

**File:** `backend/routes/scans.js`, lines ~28–34

```js
const field = db.prepare('SELECT * FROM fields WHERE id = ? AND user_id = ?').get(field_id, req.user.id);
```

The entire `field` row is passed directly to `analyzeImage(imagePath, field)`. The `fields` table has a `crop_type` column that holds whatever the farmer entered when creating the field (confirmed in `backend/db/database.js`):

```sql
CREATE TABLE IF NOT EXISTS fields (
  ...
  crop_type TEXT,
  ...
);
```

There is no mechanism that separates "the crop the farmer said they planted" from "the crop the AI should identify from the image." Both data points are treated as the same thing.

---

## Conclusions

| Path | Symptom | Root Cause |
|------|---------|-----------|
| Mock/fallback (no OpenAI key) | `crop_type` in result = saved field crop | `result.crop_type` is explicitly overwritten with `fieldInfo.crop_type` after mock scenario selection |
| Real AI (valid OpenAI key) | `crop_type` in result = saved field crop | Prompt tells GPT-4o the crop type upfront, anchoring its answer |

---

## Recommended Fixes

### Fix 1 — Remove the `crop_type` override in the mock path

**File:** `backend/services/aiAnalysis.js`

Change:
```js
result = {
  ...scenario,
  crop_type: fieldInfo.crop_type || scenario.crop_type,
};
```

To:
```js
result = { ...scenario };
// crop_type comes from the scenario itself; do not override with saved field value
```

The scenario's own `crop_type` (e.g. `"Maize"`, `"Tomato"`) is already consistent with the scenario content. Removing the override ensures the mock output is internally consistent, and eliminates the misleading behaviour. (Note: mock mode cannot truly identify crop from image; this just stops it from actively lying about what it found.)

---

### Fix 2 — Rephrase the OpenAI prompt to ask for identification, not confirmation

**File:** `backend/services/aiAnalysis.js`

Change the user message text from:
```js
text: `Analyze this crop image. Field info: crop type: ${fieldInfo.crop_type || 'unknown'}, soil type: ${fieldInfo.soil_type || 'unknown'}, planting date: ${fieldInfo.planting_date || 'unknown'}. Return only the JSON.`
```

To something like:
```js
text: `Analyze this crop image. Identify the crop species from the image itself. Additional field context (for reference only, do not use to determine crop type): soil type: ${fieldInfo.soil_type || 'unknown'}, planting date: ${fieldInfo.planting_date || 'unknown'}. Return only the JSON.`
```

Key changes:
- **Remove `crop type: ...` from the prompt entirely**, or label it clearly as "farmer-reported" context that the AI should cross-reference, not blindly accept.
- Add the explicit instruction "Identify the crop species from the image itself."

Optionally, after getting the AI result, you can compare `result.crop_type` against `fieldInfo.crop_type` and surface a warning to the farmer if they differ (e.g. "AI identified this as Tomato but your field is registered as Maize — please verify").

---

### Fix 3 (Optional) — Surface crop-type mismatch as a warning

After the AI call returns, add a check:

```js
if (
  usedAI &&
  fieldInfo.crop_type &&
  result.crop_type &&
  result.crop_type.toLowerCase() !== fieldInfo.crop_type.toLowerCase()
) {
  result.summary = `[Note: AI identified crop as "${result.crop_type}" but field is registered as "${fieldInfo.crop_type}". Please verify.] ` + result.summary;
}
```

This keeps farmers informed when the image doesn't match their field registration, without blocking the analysis.

---

## Files to Modify

| File | Change |
|------|--------|
| `backend/services/aiAnalysis.js` | Remove `crop_type` override in mock path (Fix 1) |
| `backend/services/aiAnalysis.js` | Rephrase OpenAI user message to not reveal saved crop (Fix 2) |
| `backend/services/aiAnalysis.js` | Optionally add mismatch warning (Fix 3) |

No changes needed to `routes/scans.js`, `routes/fields.js`, `db/database.js`, or `middleware/auth.js` — the data flow is correct; only the prompt construction and mock override are wrong.
