// Aguarda o DOM estar completamente carregado para executar o script
document.addEventListener('DOMContentLoaded', () => {

    const loginForm = document.getElementById('login-form');
    const errorMessage = document.getElementById('error-message');

    // Adiciona um "ouvinte" para o evento de submissão do formulário
    loginForm.addEventListener('submit', async (event) => {
        // Previne o comportamento padrão do formulário (que é recarregar a página)
        event.preventDefault();

        // Limpa mensagens de erro anteriores
        errorMessage.textContent = '';

        // Pega os valores dos campos de email e senha
        const email = document.getElementById('email').value;
        const senha = document.getElementById('senha').value;

        try {
            // Faz a requisição para a nossa API de login
            const response = await fetch('http://localhost:3001/api/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email: email, senha: senha }),
            });

            const data = await response.json();

            if (response.ok) {
                // Se o login for bem-sucedido (status 200-299)
                alert('Login realizado com sucesso!');
                // Salva o token no localStorage do navegador para uso futuro
                localStorage.setItem('authToken', data.token);
                // Redireciona o usuário para a página principal da agenda
                 window.location.href = 'index.html'; // <<-- Descomente quando a página principal existir
            } else {
                // Se houver um erro (status 4xx, 5xx)
                errorMessage.textContent = data.message || 'Erro ao fazer login.';
            }

        } catch (error) {
            console.error('Erro na requisição:', error);
            errorMessage.textContent = 'Não foi possível conectar ao servidor. Tente novamente mais tarde.';
        }
    });
});
