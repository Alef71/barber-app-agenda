// server.js (Versão final corrigida para usar PostgreSQL no Render)

// 1. IMPORTAÇÕES
const express = require('express');
const { Pool } = require('pg'); // <-- MUDANÇA: Importa a biblioteca 'pg' em vez de 'mysql2'
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// 2. CONFIGURAÇÃO INICIAL
const app = express();
const port = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'seu_segredo_super_secreto_aqui';

// 3. MIDDLEWARES
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// 4. CONFIGURAÇÃO DO BANCO DE DADOS (AGORA COM POSTGRESQL)
let pool;

// Função principal para iniciar a aplicação
async function main() {
    try {
        if (process.env.DATABASE_URL) {
            // Ambiente de produção (Render) - usa a variável de ambiente do PostgreSQL
            pool = new Pool({
                connectionString: process.env.DATABASE_URL,
                ssl: {
                    rejectUnauthorized: false
                }
            });
            console.log('\nConectado ao banco de dados do Render (PostgreSQL) com sucesso!');
        } else {
            // Ambiente de desenvolvimento (seu PC) - Se você tiver um PostgreSQL local, use as configurações
            // Para o MySQL local, esta parte do código precisa ser alterada, mas o foco é no deploy do Render.
            console.error('Variável DATABASE_URL não encontrada. Usando o banco de dados local (pode não funcionar sem ajustes).');
            // Por enquanto, vamos manter a lógica de erro para forçar o uso da URL de produção.
            process.exit(1); 
        }
    } catch (error) {
        console.error('Falha ao conectar ao banco de dados:', error);
        process.exit(1);
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
            const result = await pool.query('SELECT * FROM usuarios WHERE email = $1', [email]); // <-- MUDANÇA: 'pool.query' e '$1'
            if (result.rows.length === 0) return res.status(401).json({ message: 'Credenciais inválidas.' }); // <-- MUDANÇA: 'result.rows'
            const usuario = result.rows[0];
            const senhaCorreta = await bcrypt.compare(senha, usuario.senha_hash);
            if (!senhaCorreta) return res.status(401).json({ message: 'Credenciais inválidas.' });
            const token = jwt.sign({ id: usuario.id, nome: usuario.nome }, JWT_SECRET, { expiresIn: '8h' });
            res.status(200).json({ message: 'Login bem-sucedido!', token: token });
        } catch (error) {
            console.error(error); // Adicionado para depuração
            res.status(500).json({ message: 'Erro interno do servidor.' });
        }
    });

    app.get('/api/agendamentos', verificarToken, async (req, res) => {
        const { data } = req.query;
        if (!data) return res.status(400).json({ error: 'A data é um parâmetro obrigatório.' });
        try {
            const query = `SELECT a.*, c.nome as nome_cliente FROM agendamentos a LEFT JOIN clientes c ON a.id_cliente = c.id WHERE DATE(a.data_hora) = $1 ORDER BY a.data_hora;`; // <-- MUDANÇA: '$1'
            const result = await pool.query(query, [data]); // <-- MUDANÇA: 'pool.query'
            res.status(200).json(result.rows); // <-- MUDANÇA: 'result.rows'
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Erro interno do servidor.' });
        }
    });

    app.get('/api/clientes', verificarToken, async (req, res) => {
        try {
            const result = await pool.query('SELECT * FROM clientes ORDER BY nome'); // <-- MUDANÇA: 'pool.query'
            res.status(200).json(result.rows); // <-- MUDANÇA: 'result.rows'
        } catch (error) {
            console.error(error);
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
                const result = await pool.query('INSERT INTO clientes (nome, telefone) VALUES ($1, $2) RETURNING id', [nome_cliente, telefone]); // <-- MUDANÇA: 'pool.query', '$1', '$2' e 'RETURNING id'
                id_cliente = result.rows[0].id; // <-- MUDANÇA: Obter o ID do resultado da query
            }
            await pool.query('INSERT INTO agendamentos (id_cliente, data_hora, servico, valor, status) VALUES ($1, $2, $3, $4, $5)', [id_cliente, data_hora, servico, valor, 'Confirmado']); // <-- MUDANÇA: 'pool.query' e '$1', '$2', ...
            res.status(201).json({ message: 'Operação realizada com sucesso!' });
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Erro ao criar registo.' });
        }
    });
    
    app.delete('/api/agendamentos/:id', verificarToken, async (req, res) => {
        const { id } = req.params;
        if (!id) return res.status(400).json({ error: 'O ID do agendamento é obrigatório.' });
        try {
            await pool.query('DELETE FROM agendamentos WHERE id = $1', [id]); // <-- MUDANÇA: 'pool.query' e '$1'
            res.status(200).json({ message: 'Agendamento excluído com sucesso!' });
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Erro ao excluir agendamento.' });
        }
    });

    app.get('/api/relatorios/diario', verificarToken, async (req, res) => {
        const { data } = req.query;
        if (!data) return res.status(400).json({ error: 'A data é obrigatória.' });
        try {
            const result = await pool.query(`SELECT SUM(valor) as total FROM agendamentos WHERE DATE(data_hora) = $1 AND status = 'Confirmado';`, [data]); // <-- MUDANÇA: 'pool.query' e '$1'
            res.status(200).json({ total_dia: result.rows[0].total || 0 }); // <-- MUDANÇA: 'result.rows[0]'
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Erro interno do servidor.' });
        }
    });

    app.get('/api/relatorios/mensal', verificarToken, async (req, res) => {
        const { mes } = req.query;
        if (!mes) return res.status(400).json({ error: 'O mês é obrigatório.' });
        try {
            const result = await pool.query(`SELECT SUM(valor) as total FROM agendamentos WHERE TO_CHAR(data_hora, 'YYYY-MM') = $1 AND status = 'Confirmado';`, [mes]); // <-- MUDANÇA: 'pool.query' e 'TO_CHAR' para PostgreSQL
            res.status(200).json({ total_mes: result.rows[0].total || 0 }); // <-- MUDANÇA: 'result.rows[0]'
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Erro interno do servidor.' });
        }
    });

    app.listen(port, () => {
        console.log(`Servidor rodando na porta ${port}`);
    });
}

main();