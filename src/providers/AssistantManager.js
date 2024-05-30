import OpenAI from 'openai';
import { v4 as uuidv4 } from 'uuid';
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import { exec } from 'child_process';
import { existsSync } from 'fs';
import { promises as fsPromises } from 'fs';
import { promisify } from 'util';

const { readFile } = fsPromises;
const execAsync = promisify(exec);

const builtInModules = [
    'assert', 'buffer', 'child_process', 'cluster', 'crypto', 'dgram', 'dns', 'domain', 'events', 'fs',
    'http', 'https', 'http2', 'inspector', 'module', 'net', 'os', 'path', 'perf_hooks', 'process', 'punycode',
    'querystring', 'readline', 'repl', 'stream', 'string_decoder', 'timers', 'tls', 'trace_events', 'tty',
    'url', 'util', 'v8', 'vm', 'worker_threads', 'zlib', 'child_process'
];

export default class AssistantManager {
    constructor() {
        this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        this.users = {}; // Store user sessions
        this.externalFunctions = {}; // Store externally defined functions
    }
    async sleep(time) {
        return new Promise(resolve => setTimeout(resolve, time));
    }

    addExternalFunction(created_by, name, func) {
        if (!this.externalFunctions.hasOwnProperty(created_by))
            this.externalFunctions[created_by] = {}

        this.externalFunctions[created_by][name] = func;
    }

    async loadExternalFunctions(created_by) {
        try {
            const assistant = await this.findAssistant(created_by);
            if (!assistant) {
                console.error("Error: Assistant not set.");
                return;
            }
    
            const functionsDir = path.join('src', 'functions');
    
            // Check if the functions directory exists
            if (!existsSync(functionsDir)) {
                console.error("Functions directory not found.");
                return;
            }
    
            // Get the list of function names for the assistant
            const functionNames = await this.listFunctionsInAssistant(created_by);
    
            for (const functionName of functionNames) {
                const filePath = path.join(process.cwd(), 'src', 'functions', `${functionName}.mjs`);
    
                if (!existsSync(filePath)) {
                    console.error(`Function file ${filePath} not found.`);
                    continue;
                }

                // Read the file to find import statements
                const fileContent = await readFile(filePath, 'utf8');
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
                const fileUrl = pathToFileURL(filePath).href;

                // Use dynamic import to load the ES module
                const importedModule = await import(fileUrl);
    
                // Check if the functionName is a function
                if (typeof importedModule[importedModule.functionName] !== 'function') {
                    console.error(`The variable functionName in the file ${filePath} is not a function.`);
                    continue;
                }
    
                this.addExternalFunction(created_by, importedModule.functionName, importedModule[importedModule.functionName]);
            }
        } catch (error) {
            console.error("Error:", error);
        }
    }

    async reloadExternalFunctions(assistantId) {
        delete this.externalFunctions[assistantId];

        this.loadExternalFunctions(assistantId);
    }

    async createRun(assistantId, threadId) {
        return await this.openai.beta.threads.runs.create(threadId, {
            assistant_id: assistantId,
        });
    }
    async getSessionId() {
        return uuidv4();
    }
    async getSessionThread(sessionId) {
        if (!this.users[sessionId]) {
            this.users[sessionId] = {
                thread: await this.openai.beta.threads.create(),
                assistant: null,
            };
        }
    }
    async waitUntilNextStep(run, threadId) {
        let latestRun = await this.openai.beta.threads.runs.retrieve(threadId, run.id);
        while (latestRun.status === "queued" || latestRun.status === "in_progress") {
            latestRun = await this.openai.beta.threads.runs.retrieve(threadId, run.id);
        }
        return latestRun;
    }
    async submitToolOutputs(threadId, runId, outputs) {
        return this.openai.beta.threads.runs.submitToolOutputs(threadId, runId, {
            tool_outputs: outputs,
        });
    }
    async getActiveRun(threadId) {
        try {
            const { data } = await this.openai.beta.threads.runs.list(threadId);
            return data.find((run) => run.status === "requires_action" || run.status === "queued" || run.status === "in_progress" || run.status === "cancelling");
        } catch (error) {
            return null;
        }
    }
    async createUserMessageInThread(threadId, message) {
        return this.openai.beta.threads.messages.create(threadId, {
            role: "user",
            content: message
        });
    }
    async getThreadMessagesById(threadId) {
        try {
            const { data } = await this.openai.beta.threads.messages.list(threadId);
            return data;
        } catch (error) {
            return [];
        }
    }
    padAndCutString(str, length) {
        return str.padEnd(length).substring(0, length);
    }
    async listAssistants(full = false) {
        try {
            const myAssistants = await this.openai.beta.assistants.list({
                order: "desc",
                limit: "100",
            });
            if (!full) {
                console.log("\nList of assistants in OpenAI platform:");
                console.log("name\t\t|\tid");
                for (const assistant of myAssistants.data) {
                    console.log(`${this.padAndCutString(assistant.name, 10)}\t|\t${assistant.metadata?.created_by}`);
                }
            } else {
                console.log(myAssistants.data);
            }
            return myAssistants;
        } catch (error) {
            console.error("Error:", error);
            return null;
        }
    }
    async findAssistant(created_by) {
        try {
            const { data } = await this.openai.beta.assistants.list();
            return data.find((assistant) => assistant.metadata === null || assistant.metadata === void 0 ? void 0 : assistant.metadata.created_by === created_by);
        } catch (error) {
            console.error("Error:", error);
            return null;
        }
    }
    async deleteAssistant(options) {
        try {
            const myAssistants = await this.openai.beta.assistants.list({
                order: "desc",
                limit: "100",
            });
            let found = false;
            for (const assistant of myAssistants.data) {
                let shouldDelete = false;
                if (options.name && assistant.name === options.name) {
                    shouldDelete = true;
                }
                if (options.id && assistant.id === options.id) {
                    shouldDelete = true;
                }
                if (options.created_by && assistant.metadata !== null && assistant.metadata === void 0 ? void 0 : assistant.metadata.created_by === options.created_by) {
                    shouldDelete = true;
                }
                if (shouldDelete) {
                    found = true;
                    const response = await this.openai.beta.assistants.del(assistant.id);
                    console.log(response);
                }
            }
            if (!found) {
                console.log("\nCould not find target assistant");
            }
        } catch (error) {
            console.error("Error:", error);
        }
    }
    async createOrFindAssistant(created_by, options) {
        try {
            const assistant = await this.findAssistant(created_by);
            if (!assistant) {
                const assistantPayload = {
                    name: options.name || "Custom Assistant",
                    instructions: options.instructions || "Custom instructions for the assistant",
                    model: options.model || "gpt-3.5-turbo-0125",
                    description: options.description || "Made by Gabriel",
                    metadata: {
                        created_by: created_by || "gabriel",
                    },
                };
                if (options.tools) {
                    assistantPayload.tools = options.tools;
                }
                const newAssistant = await this.openai.beta.assistants.create(assistantPayload);
                console.log(`ASSISTANT ID for created_by ${created_by}: ${newAssistant.id}`);
                return newAssistant;
            } else {
                return assistant;
            }
        } catch (error) {
            console.error("Error:", error);
            return null;
        }
    }
    async listFunctionsInAssistant(created_by) {
        try {
            const assistant = await this.findAssistant(created_by);
            if (!assistant) {
                console.error("Error: Assistant not found.");
                return [];
            }
            const tools = assistant.tools || [];
            const functionNames = tools
                .filter(tool => tool.function)
                .map(tool => tool.function.name);
            console.log("\nFunctions in the assistant:");
            functionNames.forEach(name => console.log(name));
            return functionNames;
        } catch (error) {
            console.error("Error:", error);
            return [];
        }
    }
    async addFunctionToAssistant(created_by, functionPayload) {
        try {
            const assistant = await this.findAssistant(created_by);
            if (!assistant) {
                console.error("Error: Assistant not found.");
                return;
            }
            const existingTools = assistant.tools || [];
            const isExistingFunction = existingTools.some(tool => tool.function && tool.function.name === functionPayload.function.name);
            if (isExistingFunction) {
                console.log(`\nFunction ${functionPayload.function.name} already exists in the assistant.`);
                return;
            }
            const updatedAssistant = await this.openai.beta.assistants.update(assistant.id, {
                tools: [
                    ...existingTools,
                    functionPayload,
                ],
            });
            console.log("\nFunction added to the assistant successfully.");
        } catch (error) {
            console.error("Error:", error);
        }
    }
    async deleteFunctionFromAssistant(created_by, functionName) {
        try {
            const assistant = await this.findAssistant(created_by);
            if (!assistant) {
                console.error("Error: Assistant not found.");
                return;
            }

            // Get the list of functions in the assistant
            const assistantFunctions = await this.listFunctionsInAssistant(created_by);

            // Check if the function to delete exists in the assistant
            const funcToDelete = assistantFunctions.find(func => func === functionName);
            if (!funcToDelete) {
                console.log(`\nFunction '${functionName}' not found in the assistant.`);
                return;
            }

            // Filter out the function to delete from the assistant's tools
            const updatedAssistant = await this.openai.beta.assistants.update(assistant.id, {
                tools: (assistant.tools || []).filter(tool => tool.function && tool.function.name !== functionName)
            });

            console.log("\nFunction deleted from the assistant successfully.");
        } catch (error) {
            console.error("Error:", error);
        }
    }
    async linkFilesToAssistant(created_by, options) {
        try {
            const assistant = await this.findAssistant(created_by);
            if (!assistant)
                return;
            const assistantFiles = await this.openai.beta.assistants.files.list(assistant.id);
            console.log(assistantFiles);
            for (const file of assistantFiles.data) {
                const deletedAssistantFile = await this.openai.beta.assistants.files.del(assistant.id, file.id);
                console.log("\nFile deleted from the assistant:");
                console.log(deletedAssistantFile);
            }
            const listing = fs.readdirSync(options.path);
            for (const fileName of listing) {
                const file = await this.openai.files.create({
                    file: fs.createReadStream(options.path + "./" + fileName),
                    purpose: "assistants",
                });
                const myAssistantFile = await this.openai.beta.assistants.files.create(assistant.id, {
                    file_id: file.id
                });
                console.log("\nFile uploaded to the assistant:");
                console.log(myAssistantFile);
            }
        } catch (error) {
            console.error("Error:", error);
        }
    }
    async deleteFileFromAssistant(created_by, fileName) {
        try {
            const assistant = await this.findAssistant(created_by);
            if (!assistant) {
                console.error("Error: Assistant not found.");
                return;
            }
            const assistantFiles = await this.listFilesInAssistant(created_by);
            const fileToDelete = assistantFiles.find(file => file.filename === fileName);
            if (!fileToDelete) {
                console.log(`\nFile '${fileName}' not found in the assistant.`);
                return;
            }
            const deletedAssistantFile = await this.openai.beta.assistants.files.del(assistant.id, fileToDelete.id);
            console.log("\nFile deleted from the assistant: ", deletedAssistantFile);
        } catch (error) {
            console.error("Error deleting file from the assistant:", error);
        }
    }
    async enableTools(assistantId, tools) {
        try {
            const assistant = await this.openai.beta.assistants.retrieve(assistantId);
            if (!assistant) {
                console.error("Assistant not found.");
                return;
            }
            const enabledTools = assistant.tools || [];
            for (const tool of tools) {
                const toolObject = { type: tool };
                if (enabledTools.some(existingTool => existingTool.type === tool)) {
                    console.log(`\nTool '${tool}' is already enabled for the assistant.`);
                } else {
                    enabledTools.push(toolObject);
                    console.log(`\nTool '${tool}' has been enabled for the assistant.`);
                }
            }
            const updatedAssistant = await this.openai.beta.assistants.update(assistantId, {
                tools: enabledTools
            });
            console.log("Assistant updated with enabled tools:");
            console.log(updatedAssistant);
            return updatedAssistant;
        } catch (error) {
            console.error("Error:", error);
        }
    }
    async listFileIds(files) {
        try {
            if (!files || !Array.isArray(files)) {
                throw new Error("Invalid input: files array is required.");
            }
            const fileIds = files.map(file => file.id);
            console.log("\nFile IDs:");
            fileIds.forEach(id => console.log(id));
            return fileIds;
        } catch (error) {
            console.error("Error listing file IDs:", error);
            return [];
        }
    }
    async listFilesInAssistant(created_by) {
        try {
            const assistant = await this.findAssistant(created_by);
            if (!assistant) {
                console.error("Error: Assistant not found.");
                return [];
            }
            const fileIds = assistant.file_ids || [];
            const files = [];
            console.log("\nFiles in the assistant:");
            for (const fileId of fileIds) {
                const fileDetails = await this.openai.files.retrieve(fileId);
                files.push(fileDetails);
                console.log(fileDetails);
            }
            return files;
        } catch (error) {
            console.error("Error listing files in the assistant:", error);
            return [];
        }
    }
    async uploadFileToAssistant(created_by, options) {
        try {
            const filePath = "./" + options.fileName;
            console.log(filePath);
            const assistant = await this.findAssistant(created_by);
            if (!assistant)
                return;
            await this.enableTools(assistant.id, ['retrieval' /*, 'code_interpreter'*/]);
            const filesInAssistant = await this.listFilesInAssistant(created_by);
            const fileExists = filesInAssistant.some(file => file.filename === options.fileName);
            if (fileExists) {
                console.log(`File '${options.fileName}' already exists in the assistant.`);
                return;
            }
            const file = await this.openai.files.create({
                file: fs.createReadStream(filePath),
                purpose: "assistants",
            });
            const myAssistantFile = await this.openai.beta.assistants.files.create(assistant.id, {
                file_id: file.id
            });
            console.log("\nFile uploaded to the assistant:");
            console.log(myAssistantFile);
        } catch (error) {
            console.error("Error:", error);
        }
    }
    async downloadFileFromAssistant(created_by, fileName, destinationPath) {
        try {
            const assistant = await this.findAssistant(created_by);
            if (!assistant) {
                console.error("Error: Assistant not found.");
                return;
            }
            const assistantFiles = await this.listFilesInAssistant(created_by);
            const fileToDownload = assistantFiles.find(file => file.filename === fileName);
            if (!fileToDownload) {
                console.log(`\nFile '${fileName}' not found in the assistant.`);
                return;
            }
            const fileStream = await this.openai.files.download(fileToDownload.id);
            const destination = fs.createWriteStream(destinationPath + fileName);
            fileStream.pipe(destination);
            console.log(`\nFile '${fileName}' downloaded successfully to '${destinationPath}'.`);
        } catch (error) {
            console.error("Error downloading file from the assistant:", error);
        }
    }
    async handleUserMessage(created_by, message, sessionId, contact = null) {
        if (!message || message.trim() === "") {
            console.error("Error: Message content must be non-empty.");
            return;
        }
        const created = this.users.hasOwnProperty(sessionId);
        await this.getSessionThread(sessionId);
        let user = this.users[sessionId];
        if (!user) {
            throw new Error("Session hasn't initiated.");
        }
        let run = await this.getActiveRun(user.thread.id);
        if (!run) {
            //if (created && contact?.dataValues?.name) {
            //    message = `Nome do cliente: ${contact.dataValues.name}\nMensagem do cliente: ${message}`;
            //}
            await this.createUserMessageInThread(user.thread.id, message);
            const assistant = await this.findAssistant(created_by);
            if (!assistant) {
                console.error("Error: Assistant not found.");
                return;
            }
            run = await this.createRun(assistant.id, user.thread.id);
            run = await this.waitUntilNextStep(run, user.thread.id);
        }
        while (run.required_action && run.required_action.type === "submit_tool_outputs") {
            console.log(run.required_action === null || run.required_action === void 0 ? void 0 : run.required_action.submit_tool_outputs.tool_calls);
            const toolCalls = run.required_action.submit_tool_outputs.tool_calls;
            const toolOutputs = [];
            for (let i = 0; i < toolCalls.length; i++) {
                const functionName = toolCalls[i].function.name;
                const functionArgs = JSON.parse(toolCalls[i].function.arguments);
                let functionOutput = "{success: true}";
                if (functionName.startsWith("ui_")) {
                    const actionReponse = {
                        action: functionName,
                        actionArgs: functionArgs
                    };
                    console.log(`${JSON.stringify(actionReponse)} <-- JSON`);
                } else {
                    functionOutput = await this.handleToolCall(created_by, functionName, functionArgs);
                }
                toolOutputs.push({
                    tool_call_id: toolCalls[i].id,
                    output: functionOutput
                });
            }
            const toolOutputRun = await this.submitToolOutputs(user.thread.id, run.id, toolOutputs);
            run = await this.waitUntilNextStep(toolOutputRun, user.thread.id);
        }
        const messages = await this.getThreadMessagesById(user.thread.id);
        const lastMessage = messages[0]; // Get the last message

        return lastMessage.content && lastMessage.content.length > 0 && lastMessage.content[0].text ? lastMessage.content[0].text.value : '';
    }
    async handleToolCall(created_by, functionName, functionArgs) {
        return new Promise(async (resolve, reject) => {
            const externalFunction = this.externalFunctions[created_by][functionName];
            if (externalFunction) {
                try {
                    const result = await externalFunction(functionArgs);

                    if (functionName === "createNewFunction" && functionArgs.name) {
                        await this.sleep(1500);
                        // Import the new function from the src/functions directory
                        const filePath = path.join('src', 'functions', `${functionArgs.name}.mjs`);
    
                        // Resolve the full path and check if the file exists
                        const resolvedPath = path.resolve(filePath);
                        if (!existsSync(resolvedPath)) {
                            console.error("File not found.");
                            return;
                        }
    
                        // Read the file to find import statements
                        const fileContent = await readFile(resolvedPath, 'utf8');
                        const importRegex = /import\s+.*\s+from\s+['"](.*)['"]/g;
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
                            console.error(`The variable functionName in the file ${filePath} is not a function.`);
                            reject({ success: false, message: 'The variable functionName is not a function' });
                            return;
                        }
    
                        this.addFunctionToAssistant(created_by, importedModule.functionOptions);
                        this.addExternalFunction(created_by, importedModule.functionName, importedModule[importedModule.functionName]);
                    }
    
                    resolve(result);
                } catch (error) {
                    console.error("Error executing function:", error);
                    reject({ success: false, message: 'Error executing function' });
                }
            } else {
                console.error(`Function '${functionName}' not found.`);
                reject({ success: false, message: 'Function not found' });
            }
        });
    }
}