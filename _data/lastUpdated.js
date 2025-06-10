const { execSync } = require('child_process');

let lastUpdated = "unknown";
try {
  const output = execSync('git log master -1 --format=%cd --date=iso', { encoding: 'utf-8' });
  const date = new Date(output.trim());
  const options = { year: 'numeric', month: 'long', day: 'numeric' };
  lastUpdated = date.toLocaleDateString('en-US', options);
} catch (e) {
  // fallback
}

module.exports = lastUpdated;