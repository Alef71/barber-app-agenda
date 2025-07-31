// verificar-senha.js
const bcrypt = require('bcryptjs');

async function verificar() {
  const senhaPlana = '097148';
  const hashDoBanco = '$2b$10$XtLgYF34JwJQQGJCpyBFlOdO2uI6XuyM/pmLJr6LpHGM3/BjSyQuK'; // O hash que está no seu banco

  console.log('--- VERIFICANDO SENHA DIRETAMENTE ---');
  console.log('Senha a ser testada:', senhaPlana);
  console.log('Hash a ser comparado:', hashDoBanco);

  const resultado = await bcrypt.compare(senhaPlana, hashDoBanco);

  console.log('------------------------------------');
  console.log('O resultado da comparação é:', resultado, '<-- ISTO DEVE SER TRUE');
  console.log('------------------------------------');

  if (resultado) {
    console.log('SUCESSO! A senha corresponde ao hash. O problema não está na criptografia.');
  } else {
    console.log('FALHA! A senha NÃO corresponde ao hash. Há um problema com a biblioteca bcryptjs.');
  }
}

verificar();