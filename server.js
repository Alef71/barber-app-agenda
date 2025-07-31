// server.js (Versão final, pronta para deploy no Render)

// 1. IMPORTAÇÕES
const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// 2. CONFIGURAÇÃO INICIAL
const app = express();
const port = process.env.PORT || 3001; // Render usa a variável PORT
const JWT_SECRET = process.env.JWT_SECRET || 'seu_segredo_super_secreto_aqui'; 

// 3. MIDDLEWARES
app.use(cors());
app.use(express.json()); 
app.use(express.static('public'));

// 4. CONFIGURAÇÃO DO BANCO DE DADOS LOCAL (para desenvolvimento)
const dbConfigLocal = {
    host: 'localhost',
    user: 'root',
    password: 'admin',
    database: 'barbearia_db',
    decimalNumbers: true
};

// Função principal para iniciar a aplicação
async function main() {
    let connection;

    // LÓGICA DE CONEXÃO INTELIGENTE
    try {
        if (process.env.DATABASE_URL) {
            // Ambiente de produção (Render) - usa a variável de ambiente
            connection = await mysql.createConnection(process.env.DATABASE_URL);
            console.log('\nConectado ao banco de dados do Render com sucesso!');
        } else {
            // Ambiente de desenvolvimento (seu PC) - usa a configuração local
            connection = await mysql.createConnection(dbConfigLocal);
            console.log('\nConexão com o banco de dados local MySQL bem-sucedida!');
        }
    } catch (error) {
        console.error('Falha ao conectar ao banco de dados:', error);
        process.exit(1); // Encerra a aplicação se não conseguir conectar
    }

    function verificarToken(req, res, next) {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];
        if (token == null) return res.sendStatus(401);
        jwt.verify(token, JWT_SECRET, (err, usuario) => {
            if (err) return res.sendStatus(403);
            req.usuario = usuario;
            next();
        });
    }

    // --- ROTAS DA API ---

    app.post('/api/login', async (req, res) => {
        try {
            const { email, senha } = req.body;
            if (!email || !senha) return res.status(400).json({ message: 'Email e senha são obrigatórios.' });
            const [rows] = await connection.execute('SELECT * FROM usuarios WHERE email = ?', [email]);
            if (rows.length === 0) return res.status(401).json({ message: 'Credenciais inválidas.' });
            const usuario = rows[0];
            const senhaCorreta = await bcrypt.compare(senha, usuario.senha_hash);
            if (!senhaCorreta) return res.status(401).json({ message: 'Credenciais inválidas.' });
            const token = jwt.sign({ id: usuario.id, nome: usuario.nome }, JWT_SECRET, { expiresIn: '8h' });
            res.status(200).json({ message: 'Login bem-sucedido!', token: token });
        } catch (error) {
            res.status(500).json({ message: 'Erro interno do servidor.' });
        }
    });

    app.get('/api/agendamentos', verificarToken, async (req, res) => {
        const { data } = req.query;
        if (!data) return res.status(400).json({ error: 'A data é um parâmetro obrigatório.' });
        try {
            const query = `SELECT a.*, c.nome as nome_cliente FROM agendamentos a LEFT JOIN clientes c ON a.id_cliente = c.id WHERE DATE(a.data_hora) = ? ORDER BY a.data_hora;`;
            const [agendamentos] = await connection.execute(query, [data]);
            res.status(200).json(agendamentos);
        } catch (error) {
            res.status(500).json({ error: 'Erro interno do servidor.' });
        }
    });

    app.get('/api/clientes', verificarToken, async (req, res) => {
        try {
            const [clientes] = await connection.execute('SELECT * FROM clientes ORDER BY nome');
            res.status(200).json(clientes);
        } catch (error) {
            res.status(500).json({ error: 'Erro interno do servidor.' });
        }
    });

    app.post('/api/agendamentos', verificarToken, async (req, res) => {
        let { id_cliente, nome_cliente, telefone, data_hora, servico, valor } = req.body;
        if (!data_hora || !servico || valor === undefined) return res.status(400).json({ error: 'Campos essenciais em falta.' });
        if (servico !== 'Almoço' && !servico.startsWith('Venda:') && !id_cliente && !nome_cliente) return res.status(400).json({ error: 'Um cliente é necessário.' });
        try {
            if (id_cliente === 'caixa' || servico === 'Almoço') id_cliente = null;
            else if (!id_cliente && nome_cliente) {
                const [result] = await connection.execute('INSERT INTO clientes (nome, telefone) VALUES (?, ?)', [nome_cliente, telefone]);
                id_cliente = result.insertId;
            }
            await connection.execute('INSERT INTO agendamentos (id_cliente, data_hora, servico, valor, status) VALUES (?, ?, ?, ?, ?)', [id_cliente, data_hora, servico, valor, 'Confirmado']);
            res.status(201).json({ message: 'Operação realizada com sucesso!' });
        } catch (error) {
            res.status(500).json({ error: 'Erro ao criar registo.' });
        }
    });
    
    app.delete('/api/agendamentos/:id', verificarToken, async (req, res) => {
        const { id } = req.params;
        if (!id) return res.status(400).json({ error: 'O ID do agendamento é obrigatório.' });
        try {
            await connection.execute('DELETE FROM agendamentos WHERE id = ?', [id]);
            res.status(200).json({ message: 'Agendamento excluído com sucesso!' });
        } catch (error) {
            res.status(500).json({ error: 'Erro ao excluir agendamento.' });
        }
    });

    app.get('/api/relatorios/diario', verificarToken, async (req, res) => {
        const { data } = req.query;
        if (!data) return res.status(400).json({ error: 'A data é obrigatória.' });
        try {
            const [rows] = await connection.execute(`SELECT SUM(valor) as total FROM agendamentos WHERE DATE(data_hora) = ? AND status = 'Confirmado';`, [data]);
            res.status(200).json({ total_dia: rows[0].total || 0 });
        } catch (error) {
            res.status(500).json({ error: 'Erro interno do servidor.' });
        }
    });

    app.get('/api/relatorios/mensal', verificarToken, async (req, res) => {
        const { mes } = req.query;
        if (!mes) return res.status(400).json({ error: 'O mês é obrigatório.' });
        try {
            const [rows] = await connection.execute(`SELECT SUM(valor) as total FROM agendamentos WHERE DATE_FORMAT(data_hora, '%Y-%m') = ? AND status = 'Confirmado';`, [mes]);
            res.status(200).json({ total_mes: rows[0].total || 0 });
        } catch (error) {
            res.status(500).json({ error: 'Erro interno do servidor.' });
        }
    });

    app.listen(port, () => {
        console.log(`Servidor rodando na porta ${port}`);
    });
}

main();