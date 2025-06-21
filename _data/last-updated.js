const date = new Date();
const options = { 
  year: 'numeric', 
  month: 'long', 
  day: 'numeric' 
};
const lastUpdated = date.toLocaleDateString('en-US', options);
const time = {
  raw: date.toISOString(),
  formatted: lastUpdated,
};

module.exports = time;