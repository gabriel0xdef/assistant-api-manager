import 'dotenv/config';
import AssistantManager from './providers/AssistantManager.js';
import MenuManager from './providers/MenuManager.js';

process.noDeprecation = true;

async function main() {
    try {
        console.log(`Starting AssistantManager, please wait...`);

        const assistantManager = new AssistantManager();
        const sessionId = await assistantManager.getSessionId();

        const menuManager = new MenuManager(assistantManager, sessionId);

        await menuManager.activateAssistantMenu();

        if (!menuManager.successActivated)
            await menuManager.displayMenu();

        await menuManager.startInputListener();
    } catch (error) {
        console.error("Error:", error);
    }
}

main();