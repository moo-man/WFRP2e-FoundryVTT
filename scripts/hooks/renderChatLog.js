// Activate chat listeners defined in dice-wfrp2e.js
Hooks.on('renderChatLog', (log, html, data) => {
    DiceWFRP.chatListeners(html)
    
});