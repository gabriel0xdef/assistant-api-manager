# Installation Guide

This guide will walk you through the installation process for Assistant API Manager.

## Installation

1. Clone the repository:
```
git clone https://github.com/gabrisorrentino/assistant-api-manager.git
```

2. Navigate to the project directory:
```
cd assistant-api-manager
```

3. Install dependencies using npm:
```
npm install
```

4. Rename the .env.example file to .env:
```
mv .env.example .env
```

5. Open the .env file in your preferred text editor.
Find the OPENAI_API_KEY variable and replace the placeholder value with your OpenAI API key.

6. To start the project, run the following command:
```
node src/index.js
```

# Creating a Custom Function and Import to an Assistant

This guide will guide you through the process of creating a custom function. Custom functions serve as a powerful method to expand the capabilities of your Assistant by encapsulating specific tasks or operations.

## Step 1: Creating the function file and naming it

The first step is to create a file inside the functions folder with the name of the function followed by the .js extension. Then, define the functionName with a name and functionsOptions following the template of OpenAI function tool, along with any parameters it requires.

Here's an example of how to define a custom function:
```
const functionName = "personSearch";

const functionOptions = {
    type: "function",
    function: {
        name: functionName,
        description: "Search person by name and last name",
        parameters: {
            type: "object",
            properties: {
                name: { type: "string", description: "Name" },
                lastName: { type: "string", description: "Last Name" },
            },
            required: ["name", "lastName"],
        },
    },
};
```

You can check more details in the (Function Calling OpenAI documentation)[https://platform.openai.com/docs/guides/function-calling]

## Step 2: Implement the Function

Next, implement the function logic. This is where you define the actions the function performs when called. Here's an example implementation of the personSearch function:

```
export const personSearch = async function (name, lastName) {
    try {
        if (name && lastName) {
            const searchResult = `@${name},${lastName}`;
            console.log(searchResult);
            return searchResult || [];
        }
        return [];
    } catch (e) {
        return [];
    }
};
```

Note: you have to export the function so that it can be imported into the code responsible for adding the function to the Assistant. Ensure to export both the function name, options, and the function itself.

## Step 3: Importing the Function in the Assistant
Finally, to import the function into the Assistant, you need to select the "Add function to assistant" option in the Menu and then provide the path to the file, such as ./src/functions/personSearch.js

# Import a file to an Assistant

## Step 1: Add file to assistant

The first step is to place the file inside the designated directory, such as ./public/example.pdf

## Step 2: Uploading a file to the Assistant

To utilize the file within the Assistant, you need to select the "Upload file to assistant" option and then provide the path to the function its path, for example ./src/public/example.pdf

Note: You can only upload one file at a time.