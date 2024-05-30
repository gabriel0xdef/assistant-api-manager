
export const functionName = "getCurrentDateString";

export const functionOptions = {
    type: "function",
    function: {
        name: functionName,
        description: "This function returns the current date in a string format.",
        parameters: {
            type: "object",
            properties: {},
            required: []
        }
    }
};

export const getCurrentDateString = async function () {
    const currentDate = new Date();
return currentDate.toDateString();

};
