import { promises as fsPromises } from 'fs';
import path from 'path';
import { existsSync } from 'fs';

const { writeFile } = fsPromises;

export const functionName = "createNewFunction";

export const functionOptions = {
    type: "function",
    function: {
        name: functionName,
        description: "Create a new function",
        parameters: {
            type: "object",
            properties: {
                name: {
                    type: "string",
                    description: "The name of the new function"
                },/*
                description: {
                    type: "string",
                    description: "The description of the new function"
                },*/
                code: {
                    type: "string",
                    description: "The JavaScript code of the new function"
                }/*,
                parameters: {
                    type: "object",
                    description: "The parameters of the new function",
                    properties: {} // This will be populated dynamically
                },
                libraries: {
                    type: "array",
                    description: "List of libraries to import",
                    items: {
                        type: "string"
                    }
                }*/
            },
            required: ["name", /*"description", */"code"]
        },
    }
};

export const createNewFunction = async function ({ name, /*description,*/code/*, parameters = {}, libraries = []*/ }) {
    try {
        const functionsDir = path.join(process.cwd(), 'src', 'functions');
        if (!existsSync(functionsDir)) {
            await fsPromises.mkdir(functionsDir, { recursive: true });
        }

        // Generate the function parameters string
        //const paramsString = Object.keys(parameters).join(", ");

        // Generate the import statements for the libraries
        //const importStatements = libraries.map(lib => `import ${lib} from '${lib}';`).join('\n');

        const functionCode = `${code}`;

        const filePath = path.join(functionsDir, `${name}.mjs`);
        await writeFile(filePath, functionCode);

        return `Function ${name} created and saved to ${filePath}`;
    } catch (error) {
        console.error("Error creating new function:", error);
        throw new Error("Failed to create new function");
    }
};
