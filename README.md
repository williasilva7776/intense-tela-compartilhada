# Intense — Tela Compartilhada

Projeto inicial de uma aplicação de salas por convite, com visual inspirado nas referências enviadas e identidade em preto, branco e laranja (`#FF9900`, `#FFFFFF`, `#000000`).

## O que já está no projeto
- Página inicial com criação de sala e nome opcional.
- URL de convite no formato `/sala/CODIGO`; quem abre o link vai direto à sala.
- Modal para definir o nome ao entrar, sem conta.
- Lista de participantes e opção para mudar o nome.
- Botão para copiar o convite.
- Compartilhamento de tela e tentativa de áudio da tela, conforme o suporte do navegador.
- Controles para ativar o microfone e encerrar o compartilhamento.
- Sinalização WebRTC via Socket.IO para conectar participantes.

## Como executar localmente
Requer Node.js 18 ou superior.

```bash
npm install
npm start
```

Abra `http://localhost:3000`.

## Importante para publicar na internet
1. Hospede em um serviço que suporte Node.js e WebSocket.
2. Configure HTTPS. Os navegadores exigem contexto seguro para captura de tela/microfone (localhost funciona para desenvolvimento).
3. Para conexões entre redes diferentes, configure um servidor TURN; o STUN público sozinho não garante conectividade em todas as redes.
4. Para grupos grandes, esta versão mesh (cada navegador conecta diretamente aos demais) não é escalável. Use um SFU como mediasoup, LiveKit ou Janus para produção.
5. Áudio do sistema ao compartilhar tela depende do navegador, sistema operacional e da opção marcada na janela de compartilhamento. A API `getDisplayMedia` não garante áudio em todos os dispositivos.

## Observações
- O servidor mantém as salas enquanto houver conexões, mas não persiste salas em banco de dados.
- Este é um starter funcional para desenvolvimento, não um serviço pronto para produção. Antes de lançar publicamente, implemente limites de uso, validação, proteção contra abuso, monitoramento e infraestrutura TURN/SFU.
- O logotipo enviado não foi separado como arquivo de imagem neste starter; a marca “I” é um placeholder vetorial em CSS e pode ser substituída pelo logo oficial da Intense.
