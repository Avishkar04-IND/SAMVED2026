/**
 * Health Classification Logic
 * Class A — Fit       → Heavy duty, confined space entry allowed
 * Class B — Moderate  → Surface tasks only
 * Class C — High Risk → Light duty only, NO confined space
 */
const classifyHealth = (sensorData) => {
  const { temperature, gasLevel, baseline, status } = sensorData;
  const gasDiff = gasLevel - (baseline || 452);

  if (status === 'DANGER' || temperature > 37 || gasDiff > 50) {
    return { class: 'C', label: 'High Risk',  duty: 'Light duty only — No confined space entry' };
  }
  if (temperature >= 33 || gasDiff >= 20 || status === 'WARNING') {
    return { class: 'B', label: 'Moderate',   duty: 'Surface tasks only' };
  }
  return   { class: 'A', label: 'Fit',        duty: 'Full duty — Confined space entry allowed' };
};

module.exports = { classifyHealth };