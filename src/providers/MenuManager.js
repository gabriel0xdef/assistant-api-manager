import readline from "readline";
import 'dotenv/config';
import path from 'path';
import { pathToFileURL } from 'url';
import { existsSync } from 'fs';
import { exec } from 'child_process';
import { promises as fsPromises } from 'fs';
import { promisify } from 'util';

const { readFile } = fsPromises;
const execAsync = promisify(exec);

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const prefix = 'input: ';

const builtInModules = [
    'assert', 'buffer', 'child_process', 'cluster', 'crypto', 'dgram', 'dns', 'domain', 'events', 'fs',
    'http', 'https', 'http2', 'inspector', 'module', 'net', 'os', 'path', 'perf_hooks', 'process', 'punycode',
    'querystring', 'readline', 'repl', 'stream', 'string_decoder', 'timers', 'tls', 'trace_events', 'tty',
    'url', 'util', 'v8', 'vm', 'worker_threads', 'zlib', 'child_process'
];

export default class MenuManager {
    constructor(assistantManager, sessionId) {
        this.assistantManager = assistantManager;
        this.sessionId = sessionId;
        this.operationInProgress = false;
        this.successActivated = false;
        this.created_by = null;
    }

    async startInputListener() {
        process.stdout.write(`\n\n${prefix}`);
        rl.on('line', async (input) => {
            if (input == 'break') {
                this.operationInProgress = false;
                return;
            }
            if (this.operationInProgress) {
                console.log("\nplease wait. still processing...\n\n");
                return;
            }

            if (this.created_by && (input == null || input === undefined || input === '\n' || input === '\r' || input === '')) {
                console.log("\nPlease type some message to talk with the assistant.");
                return;
            }

            if (input.toLowerCase() === 'menu' || input === '#') {
                await this.displayMenu();
            } else {
                this.operationInProgress = true;
                if (this.created_by) {
                    const assistant = await this.assistantManager.findAssistant(this.created_by);
                    if (!assistant) {
                        console.error("Error: Assistant not found.");
                        return;
                    }

                    console.log(`${assistant.name}: ${await this.assistantManager.handleUserMessage(this.created_by, input, this.sessionId)}`);
                }
                else {
                    console.log("Please activate an assistant before sending messages. Type menu and choose 1 to activate an assistant.");
                }
                this.operationInProgress = false;
            }

            rl.setPrompt(prefix, prefix.length);
            rl.prompt();
        }).on('close', function() {
            console.log('\n\nHave a great day!');
            process.exit(0);
        });
    }

    askQuestion(question) {
        return new Promise((resolve, reject) => {
            rl.question(question, (answer) => {
                resolve(answer);
            });
        });
    }

    async addFunctionMenu(created_by) {
        try {
            const assistant = await this.assistantManager.findAssistant(created_by);
            if (!assistant) {
                console.error("Error: Assistant not set.");
                return;
            }

            const filePath = await this.askQuestion("Enter the path to the file containing the function code: ");

             // Resolve the full path and check if the file exists
            const resolvedPath = path.resolve(filePath);
            if (!existsSync(resolvedPath)) {
                console.error("File not found.");
                return;
            }

            // Read the file to find import statements
            const fileContent = await readFile(resolvedPath, 'utf8');
            const importRegex = /^import\s+.*\s+from\s+['"](.*)['"]/g;
            const dependencies = [];
            let match;
            while ((match = importRegex.exec(fileContent)) !== null) {
                if (!builtInModules.includes(match[1])) {
                    dependencies.push(match[1]);
                    console.log(dependencies);
                }
            }

            // Check and install missing libraries
            for (const dep of dependencies) {
                try {
                    require.resolve(dep);
                } catch (e) {
                    console.log(`Installing missing library: ${dep}`);
                    await execAsync(`npm install ${dep}`);
                }
            }

            // Convert the file path to a file URL
            const fileUrl = pathToFileURL(resolvedPath).href;

            // Use dynamic import to load the ES module
            const importedModule = await import(fileUrl);

            // Check if the functionName is a function
            if (typeof importedModule[importedModule.functionName] !== 'function') {
                console.error("The variable functionName in the file is not a function.");
                return;
            }

            this.assistantManager.addExternalFunction(created_by, importedModule.functionName, importedModule[importedModule.functionName]);

            // Add the function to the assistant with the specified tool options
            await this.assistantManager.addFunctionToAssistant(created_by, importedModule.functionOptions);
        } catch (error) {
            console.error("Error:", error);
        }
    }

    async deleteFunctionMenu(created_by) {
        try {
            const assistant = await this.assistantManager.findAssistant(created_by);
            if (!assistant) {
                console.error("Error: Assistant not set.");
                return;
            }

            const functionName = await this.askQuestion("Enter function name to delete: ");
            await this.assistantManager.deleteFunctionFromAssistant(created_by, functionName);
        } catch (error) {
            console.error("Error:", error);
        }
    }

    async listFunctionsMenu(created_by) {
        try {
            const assistant = await this.assistantManager.findAssistant(created_by);
            if (!assistant) {
                console.error("Error: Assistant not set.");
                return;
            }

            await this.assistantManager.listFunctionsInAssistant(created_by);
        } catch (error) {
            console.error("Error:", error);
        }
    }

    async uploadFileMenu(created_by) {
        try {
            const assistant = await this.assistantManager.findAssistant(created_by);
            if (!assistant) {
                console.error("Error: Assistant not set.");
                return;
            }

            const filePath = await this.askQuestion("Enter the path to the file to be uploaded: ");

            // Check if the file exists
            if (!existsSync(filePath)) {
                console.error("File not found.");
                return;
            }

            await this.assistantManager.uploadFileToAssistant(created_by, { fileName: filePath });
        } catch (error) {
            console.error("Error:", error);
        }
    }

    async deleteFileMenu(created_by) {
        try {
            const assistant = await this.assistantManager.findAssistant(created_by);
            if (!assistant) {
                console.error("Error: Assistant not set.");
                return;
            }

            const fileName = await this.askQuestion("Enter file name to delete: ");
            await this.assistantManager.deleteFileFromAssistant(created_by, fileName);
        } catch (error) {
            console.error("Error:", error);
        }
    }

    async listFilesMenu(created_by) {
        const assistant = await this.assistantManager.findAssistant(created_by);
        if (!assistant) {
            console.error("Error: Assistant not set.");
            return;
        }

        await this.assistantManager.listFilesInAssistant(created_by);
    }

    async createAssistantMenu() {
        try {
            const assistantId = await this.askQuestion(`Enter the id of the new assistant (without spaces and using only letters and numbers and "-" or "_"): `);
            const assistantName = await this.askQuestion("Enter the name of the new assistant: ");
            const assistantInstructions = await this.askQuestion("Enter the instructions for the new assistant: ");
            const assistantModel = await this.askQuestion("Enter the model for the new assistant (e.g., gpt-3.5-turbo): ");
            const assistantDescription = await this.askQuestion("Enter the description for the new assistant: ");

            await this.assistantManager.createOrFindAssistant(assistantId, {
                created_by: assistantId,
                name: assistantName,
                instructions: assistantInstructions,
                description: assistantDescription,
                model: assistantModel
            });
        } catch (error) {
            console.error("Error:", error);
        }
    }

    async deleteAssistantMenu() {
        try {
            const assistantId = await this.askQuestion("Enter the id of the assistant to delete: ");
            await this.assistantManager.deleteAssistant({ created_by: assistantId });
        } catch (error) {
            console.error("Error:", error);
        }
    }

    async activateAssistantMenu() {
        try {
            const assistants = await this.assistantManager.listAssistants();
            if (assistants.length === 0) {
                console.error("Error: There are no assistants available to activate.");
                console.log(`\nType menu or # to access the Menu options below.`);
                return;
            }

            const assistantId = await this.askQuestion("\nEnter the id of the assistant to activate (or just press enter to go to the Menu): ");

            const assistant = await this.assistantManager.findAssistant(assistantId);
            if (!assistant) {
                console.error("Error: Assistant not found.");
                console.log(`\nType menu or # to access the Menu options below.`);
                return;
            }

            this.created_by = assistantId;

            this.successActivated = true;

            this.assistantManager.loadExternalFunctions(assistantId);

            console.log(`\nAssistant ${assistantId} activated in the conversation.`);
            console.log(`\nType menu or # to access the Menu options or just type a message to talk to the assistant:`);
        } catch (error) {
            console.error("Error:", error);
        }
    }

    async displayMenu() {
        console.log("\n\nMenu:");
        console.log("1. Activate assistant in conversation or to perform updates");
        console.log("2. Create assistant");
        console.log("3. Delete assistant");
        console.log("4. List assistants");
        console.log("5. Add function to assistant");
        console.log("6. Delete function from assistant");
        console.log("7. List functions in assistant");
        console.log("8. Reload functions in assistant");
        console.log("9. Upload file to assistant");
        console.log("10. Delete file from assistant");
        console.log("11. List files in assistant\n");

        rl.question("Enter your choice: ", async (choice) => {
            if (choice == 'break') {
                this.operationInProgress = false;
                return;
            }
            if (this.operationInProgress) {
                process.stdout.write("\nplease wait. still processing...\n\n");
                return;
            }

            switch (choice) {
                case '1':
                    this.operationInProgress = true;
                    await this.activateAssistantMenu();
                    this.operationInProgress = false;
                    break;
                case '2':
                    this.operationInProgress = true;
                    await this.createAssistantMenu();
                    this.operationInProgress = false;
                    break;
                case '3':
                    this.operationInProgress = true;
                    await this.deleteAssistantMenu();
                    this.operationInProgress = false;
                    break;
                case '4':
                    this.operationInProgress = true;
                    await this.assistantManager.listAssistants();
                    this.operationInProgress = false;
                    break;
                case '5':
                    this.operationInProgress = true;
                    await this.addFunctionMenu(this.created_by);
                    this.operationInProgress = false;
                    break;
                case '6':
                    this.operationInProgress = true;
                    await this.deleteFunctionMenu(this.created_by);
                    this.operationInProgress = false;
                    break;
                case '7':
                    this.operationInProgress = true;
                    await this.listFunctionsMenu(this.created_by);
                    this.operationInProgress = false;
                    break;
                case '8':
                    this.operationInProgress = true;
                    await this.assistantManager.reloadExternalFunctions(this.created_by);
                    this.operationInProgress = false;
                    break;
                case '9':
                    this.operationInProgress = true;
                    await this.uploadFileMenu(this.created_by);
                    this.operationInProgress = false;
                    break;
                case '10':
                    this.operationInProgress = true;
                    await this.deleteFileMenu(this.created_by);
                    this.operationInProgress = false;
                    break;
                case '11':
                    this.operationInProgress = true;
                    await this.listFilesMenu(this.created_by);
                    this.operationInProgress = false;
                    break;
                default:
                    console.log("Invalid choice.");
                    break;
            }
        });
    }
}