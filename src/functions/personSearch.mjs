export const functionName = "personSearch";

export const functionOptions = {
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

export const personSearch = async function (name, lastName) {
    try {
        if (name && lastName) {
            const searchResult = `@${name},${lastName}`;
            console.log(searchResult);
            return searchResult || []
        }
        return []
    } catch (e) {
        return []
    }
}