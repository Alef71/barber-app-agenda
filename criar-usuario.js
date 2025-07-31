// criar-usuario.js
const bcrypt = require('bcryptjs');

async function criarHash() {
  const senhaPlana = '097148';
  const salt = await bcrypt.genSalt(10);
  const hash = await bcrypt.hash(senhaPlana, salt);

  console.log('--- NOVO HASH GERADO ---');
  console.log('Copie a linha abaixo e use no comando SQL:');
  console.log(hash);
  console.log('-------------------------');
}

criarHash();
