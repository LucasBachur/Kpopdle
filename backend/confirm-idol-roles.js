require('dotenv').config();
const { getIdolsMissingRoles, pool } = require('./db');

async function main() {
  const { totalIdols, missingRoles } = await getIdolsMissingRoles();
  console.log(`Total idols: ${totalIdols}`);
  if (missingRoles.length === 0) {
    console.log('All idols have roles — no gaps found.');
  } else {
    console.log(`Idols missing roles (${missingRoles.length}):`);
    for (const idol of missingRoles) {
      console.log(`  id=${idol.id}  name=${idol.name}`);
    }
  }
}

main()
  .then(() => pool.end())
  .catch(err => { console.error('Error:', err); pool.end(); process.exit(1); });
