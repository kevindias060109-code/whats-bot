# zap-qr — lista de transmissão conectando pelo QR Code

Requisitos: Node.js 18+.

    npm install
    ADMIN_PASS=suasenha npm start     # Windows PowerShell: $env:ADMIN_PASS="suasenha"; npm start

Abra http://localhost:3000, entre com usuário `admin` e a senha, e conecte o WhatsApp.
A sessão fica salva na pasta `.wwebjs_auth` (não precisa escanear toda vez).

## Atenção
- Método NÃO oficial: viola os termos do WhatsApp e o número pode ser banido.
- Reduza o risco: envie só para quem te conhece, varie o texto, use {nome}, poucos contatos por dia.
- Rode no seu computador. Se publicar num servidor, use HTTPS e senha forte: quem acessa controla seu WhatsApp.
