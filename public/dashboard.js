document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('authToken');
    if (!token) {
        window.location.href = 'login.html';
        return;
    }

    const servicosPredefinidos = ["Almoço", "Corte Degradê", "Corte Social", "Corte Militar", "Botox", "Luzes", "Platinado", "Pigmentação", "Outro"];

    const DOM = {
        adminName: document.getElementById('admin-name'),
        faturamentoDia: document.getElementById('faturamento-dia'),
        faturamentoMes: document.getElementById('faturamento-mes'),
        logoutButton: document.getElementById('logout-button'),
        valorExtraBtn: document.getElementById('valor-extra-btn'),
        excluirVendaBtn: document.getElementById('excluir-venda-btn'),
        seletorData: document.getElementById('seletor-data'),
        colunaManha: document.getElementById('coluna-manha'),
        colunaTarde: document.getElementById('coluna-tarde'),
        agendaContainer: document.getElementById('agenda-container'),
        
        agendamento: {
            modal: document.getElementById('modal-agendamento'),
            closeBtn: document.querySelector('#modal-agendamento .close-btn'),
            horarioEl: document.getElementById('modal-horario'),
            form: document.getElementById('agendamento-form'),
            clienteSection: document.getElementById('cliente-section'),
            clienteSelect: document.getElementById('cliente-existente'),
            novoClienteFields: document.getElementById('novo-cliente-fields'),
            servicoSelect: document.getElementById('servico'),
            valorInput: document.getElementById('valor')
        },
        exclusao: {
            modal: document.getElementById('modal-exclusao'),
            cancelBtn: document.getElementById('cancelar-exclusao-btn'),
            confirmBtn: document.getElementById('confirmar-exclusao-btn')
        },
        listaVendas: {
            modal: document.getElementById('modal-lista-vendas'),
            closeBtn: document.querySelector('#modal-lista-vendas .close-btn'),
            container: document.getElementById('lista-vendas-container')
        }
    };

    let horarioSelecionado = '';
    let agendamentoParaExcluirId = null;

    function formatarData(data) { return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(data.getDate()).padStart(2, '0')}`; }
    function parseJwt(token) { try { return JSON.parse(atob(token.split('.')[1])); } catch (e) { return null; } }

    function renderizarAgenda(agendamentos = []) {
        DOM.colunaManha.innerHTML = '';
        DOM.colunaTarde.innerHTML = '';
        for (let hora = 7; hora < 20; hora++) {
            for (let minuto = 0; minuto < 60; minuto += 30) {
                const horario = `${String(hora).padStart(2, '0')}:${String(minuto).padStart(2, '0')}`;
                const agendamento = agendamentos.find(ag => new Date(ag.data_hora).getHours() === hora && new Date(ag.data_hora).getMinutes() === minuto);
                const slotDiv = document.createElement('div');
                slotDiv.classList.add('time-slot');
                if (agendamento) {
                    slotDiv.classList.add('ocupado');
                    const nome = agendamento.nome_cliente || 'Venda no Caixa';
                    slotDiv.innerHTML = `<div class="horario">${horario}</div><div class="info"><strong>${nome}</strong><span>${agendamento.servico} - R$ ${agendamento.valor.toFixed(2)}</span></div><button class="excluir-btn" data-id="${agendamento.id}">&times;</button>`;
                } else {
                    slotDiv.classList.add('livre');
                    slotDiv.innerHTML = `<div class="horario">${horario}</div><div class="info"><span>Livre</span><button class="marcar-btn" data-horario="${horario}">Marcar</button></div>`;
                }
                if (hora < 13) DOM.colunaManha.appendChild(slotDiv);
                else DOM.colunaTarde.appendChild(slotDiv);
            }
        }
    }

    async function atualizarDashboard() {
        try {
            const dataSelecionada = DOM.seletorData.value;
            const mesSelecionado = dataSelecionada.slice(0, 7);
            const headers = { 'Authorization': `Bearer ${token}` };
            const [resAgendamentos, resClientes, resRelatorioDiario, resRelatorioMensal] = await Promise.all([
                fetch(`/api/agendamentos?data=${dataSelecionada}`, { headers }), fetch('/api/clientes', { headers }),
                fetch(`/api/relatorios/diario?data=${dataSelecionada}`, { headers }), fetch(`/api/relatorios/mensal?mes=${mesSelecionado}`, { headers })
            ]);
            if (resAgendamentos.status === 401) { localStorage.removeItem('authToken'); window.location.href = 'login.html'; return; }
            const [agendamentos, clientes, relatorioDiario, relatorioMensal] = await Promise.all([resAgendamentos.json(), resClientes.json(), resRelatorioDiario.json(), resRelatorioMensal.json()]);
            renderizarAgenda(agendamentos);
            popularClientesSelect(clientes);
            DOM.faturamentoDia.textContent = `R$ ${relatorioDiario.total_dia.toFixed(2)}`;
            DOM.faturamentoMes.textContent = `R$ ${relatorioMensal.total_mes.toFixed(2)}`;
        } catch (error) { console.error('Erro ao buscar dados:', error); }
    }
    
    function popularClientesSelect(clientes) {
        DOM.agendamento.clienteSelect.innerHTML = '<option value="">-- Cliente Novo --</option>';
        clientes.forEach(cliente => { const option = document.createElement('option'); option.value = cliente.id; option.textContent = cliente.nome; DOM.agendamento.clienteSelect.appendChild(option); });
    }

    function popularServicosSelect() {
        DOM.agendamento.servicoSelect.innerHTML = '<option value="">-- Selecione o Serviço --</option>';
        servicosPredefinidos.forEach(servico => { const option = document.createElement('option'); option.value = servico; option.textContent = servico; DOM.agendamento.servicoSelect.appendChild(option); });
    }

    // --- Funções de Modal ---
    function abrirModalAgendamento(horario) {
        horarioSelecionado = horario;
        DOM.agendamento.horarioEl.textContent = horario;
        DOM.agendamento.form.reset();
        DOM.agendamento.clienteSection.style.display = 'block';
        DOM.agendamento.novoClienteFields.style.display = 'block';
        DOM.agendamento.clienteSelect.value = '';
        DOM.agendamento.valorInput.readOnly = false;
        DOM.agendamento.modal.style.display = 'flex';
    }
    function fecharModalAgendamento() { DOM.agendamento.modal.style.display = 'none'; }
    function abrirModalExclusao(id) { agendamentoParaExcluirId = id; DOM.exclusao.modal.style.display = 'flex'; }
    function fecharModalExclusao() { agendamentoParaExcluirId = null; DOM.exclusao.modal.style.display = 'none'; }
    function fecharModalListaVendas() { DOM.listaVendas.modal.style.display = 'none'; }

    async function abrirModalListaVendas() {
        const dataSelecionada = DOM.seletorData.value;
        const res = await fetch(`/api/agendamentos?data=${dataSelecionada}`, { headers: { 'Authorization': `Bearer ${token}` } });
        const agendamentos = await res.json();
        const vendas = agendamentos.filter(ag => ag.servico.startsWith('Venda:'));
        
        DOM.listaVendas.container.innerHTML = '';
        if (vendas.length === 0) {
            DOM.listaVendas.container.innerHTML = '<p>Nenhuma venda registada para este dia.</p>';
        } else {
            const ul = document.createElement('ul');
            ul.className = 'lista-vendas';
            vendas.forEach(venda => {
                const li = document.createElement('li');
                li.innerHTML = `<span>${venda.servico.replace('Venda: ', '')} - R$ ${venda.valor.toFixed(2)}</span> <button class="excluir-venda-item-btn" data-id="${venda.id}">&times;</button>`;
                ul.appendChild(li);
            });
            DOM.listaVendas.container.appendChild(ul);
        }
        DOM.listaVendas.modal.style.display = 'flex';
    }

    async function executarExclusao() {
        if (!agendamentoParaExcluirId) return;
        try {
            const response = await fetch(`/api/agendamentos/${agendamentoParaExcluirId}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
            if (!response.ok) throw new Error('Falha ao excluir');
            fecharModalExclusao();
            fecharModalListaVendas();
            atualizarDashboard();
        } catch (error) { alert('Não foi possível excluir o registo.'); }
    }

    // --- Event Listeners ---
    DOM.seletorData.addEventListener('change', atualizarDashboard);
    DOM.agendaContainer.addEventListener('click', e => {
        if (e.target.matches('.marcar-btn')) abrirModalAgendamento(e.target.dataset.horario);
        if (e.target.matches('.excluir-btn')) abrirModalExclusao(e.target.dataset.id);
    });
    DOM.agendamento.closeBtn.addEventListener('click', fecharModalAgendamento);
    DOM.agendamento.modal.addEventListener('click', e => { if (e.target === DOM.agendamento.modal) fecharModalAgendamento(); });
    DOM.agendamento.clienteSelect.addEventListener('change', e => { DOM.agendamento.novoClienteFields.style.display = e.target.value ? 'none' : 'block'; });
    DOM.agendamento.servicoSelect.addEventListener('change', e => {
        const isAlmoco = e.target.value === 'Almoço';
        DOM.agendamento.valorInput.readOnly = isAlmoco;
        DOM.agendamento.valorInput.value = isAlmoco ? '0.00' : '';
        DOM.agendamento.clienteSection.style.display = isAlmoco ? 'none' : 'block';
    });
    DOM.agendamento.form.addEventListener('submit', async e => {
        e.preventDefault();
        const isAlmoco = DOM.agendamento.servicoSelect.value === 'Almoço';
        const body = {
            id_cliente: isAlmoco ? null : (DOM.agendamento.clienteSelect.value || null),
            nome_cliente: isAlmoco ? null : document.getElementById('nome-cliente').value,
            telefone: document.getElementById('telefone-cliente').value,
            data_hora: `${DOM.seletorData.value}T${horarioSelecionado}:00`,
            servico: DOM.agendamento.servicoSelect.value,
            valor: parseFloat(DOM.agendamento.valorInput.value)
        };
        try {
            const response = await fetch('/api/agendamentos', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify(body) });
            if (!response.ok) throw new Error('Falha ao salvar');
            fecharModalAgendamento();
            atualizarDashboard();
        } catch (error) { alert('Não foi possível salvar o agendamento.'); }
    });
    DOM.exclusao.cancelBtn.addEventListener('click', fecharModalExclusao);
    DOM.exclusao.confirmBtn.addEventListener('click', executarExclusao);
    DOM.valorExtraBtn.addEventListener('click', () => {
        const descricao = prompt("Descrição da Venda (ex: Pomada):");
        if (!descricao) return;
        const valor = parseFloat(prompt("Valor da Venda (R$):"));
        if (isNaN(valor) || valor <= 0) return;
        const agora = new Date();
        const body = { id_cliente: 'caixa', data_hora: `${DOM.seletorData.value}T${agora.toTimeString().slice(0,8)}`, servico: `Venda: ${descricao}`, valor: valor };
        fetch('/api/agendamentos', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify(body) }).then(res => { if (res.ok) atualizarDashboard(); else alert('Falha ao adicionar valor.'); });
    });
    DOM.excluirVendaBtn.addEventListener('click', abrirModalListaVendas);
    DOM.listaVendas.closeBtn.addEventListener('click', fecharModalListaVendas);
    DOM.listaVendas.modal.addEventListener('click', e => { if (e.target === DOM.listaVendas.modal) fecharModalListaVendas(); });
    DOM.listaVendas.container.addEventListener('click', e => { if (e.target.matches('.excluir-venda-item-btn')) abrirModalExclusao(e.target.dataset.id); });
    DOM.logoutButton.addEventListener('click', () => { localStorage.removeItem('authToken'); window.location.href = 'login.html'; });

    // --- Inicialização ---
    const userInfo = parseJwt(token);
    if (userInfo && userInfo.nome) DOM.adminName.textContent = userInfo.nome;
    DOM.seletorData.value = formatarData(new Date());
    popularServicosSelect();
    atualizarDashboard();
});
